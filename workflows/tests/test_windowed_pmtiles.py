import io
import json
import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import zarr
from affine import Affine
from morecantile import defaults
from morecantile.commons import Tile
from PIL import Image
from pmtiles.reader import Reader

from src.optimization.canonical_result import write_solver_canonical_zarr
from src.publication.windowed_pmtiles import (
    _style_destination,
    finalize_windowed_pmtiles,
    prepare_windowed_pmtiles,
    render_windowed_pmtiles_batch,
)


class WindowedPmtilesTest(unittest.TestCase):
    """Verify bounded metatile rendering and deterministic disk-backed packing."""

    def _canonical(self, directory: Path) -> Path:
        destination = directory / "canonical.zarr"
        root = zarr.open_group(str(destination), mode="w")
        domains = np.ones((64, 64), dtype=np.uint8)
        domains[8:16, 8:16] = 2
        domains[32:40, 32:40] = 3
        domains[48:56, 48:56] = 4
        root.create_dataset(
            "decision",
            data=np.where(domains == 1, 1, 0).astype(np.uint8),
            chunks=(32, 32),
            fill_value=255,
        )
        tms = defaults.tms.get("WebMercatorQuad")
        upper_left = tms.xy_bounds(Tile(1, 1, 2))
        lower_right = tms.xy_bounds(Tile(2, 2, 2))
        transform = Affine.from_gdal(
            *Affine(
                (lower_right.right - upper_left.left - 2) / 64,
                0,
                upper_left.left + 1,
                0,
                -(upper_left.top - lower_right.bottom - 2) / 64,
                upper_left.top - 1,
            ).to_gdal()
        )
        root.attrs.update(
            {
                "transform": list(transform.to_gdal()),
                "crs": "EPSG:3857",
            }
        )
        (destination / "manifest.json").write_text(
            json.dumps({"content_root": "metatile-fixture"}),
            encoding="utf-8",
        )
        return destination

    def _reader(self, path: Path) -> tuple[io.BufferedReader, Reader]:
        source = path.open("rb")

        def get_bytes(offset: int, length: int) -> bytes:
            source.seek(offset)
            return source.read(length)

        return source, Reader(get_bytes)

    def _render(self, canonical: Path, output: Path, metatile_size: int) -> Path:
        specification, batches = prepare_windowed_pmtiles(
            canonical,
            min_zoom=2,
            max_zoom=2,
            tile_size=32,
            metatile_size=metatile_size,
            png_compress_level=3,
        )
        runs = []
        for index, batch in enumerate(batches):
            run = canonical.parent / f"runs-{metatile_size}" / f"{index}.tiles"
            render_windowed_pmtiles_batch(asdict(specification), asdict(batch), run)
            runs.append(run)
        return finalize_windowed_pmtiles(
            specification,
            runs,
            output,
            maximum_merge_fan_in=2,
        )

    def test_metatile_render_matches_individual_tile_render(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            canonical = self._canonical(root)
            individual = self._render(canonical, root / "individual.pmtiles", 1)
            metatiled = self._render(canonical, root / "metatiled.pmtiles", 2)

            individual_source, individual_reader = self._reader(individual)
            metatiled_source, metatiled_reader = self._reader(metatiled)
            try:
                for x in (1, 2):
                    for y in (1, 2):
                        self.assertEqual(
                            individual_reader.get(2, x, y),
                            metatiled_reader.get(2, x, y),
                        )
                self.assertTrue(individual_reader.header()["clustered"])
                self.assertTrue(metatiled_reader.header()["clustered"])
                self.assertEqual(4, metatiled_reader.metadata()["rendered_tile_count"])
                self.assertEqual(2, metatiled_reader.metadata()["render_metatile_size"])
            finally:
                individual_source.close()
                metatiled_source.close()

    def test_decision_style_distinguishes_domain_from_nodata(self) -> None:
        destination = np.asarray([[255, 0, 1]], dtype=np.uint8)

        rgba = _style_destination(destination)

        self.assertIsNotNone(rgba)
        assert rgba is not None
        self.assertEqual(rgba[0, 0].tolist(), [0, 0, 0, 0])
        self.assertEqual(rgba[0, 1].tolist(), [160, 160, 160, 180])
        self.assertGreater(int(rgba[0, 2, 3]), 0)
        self.assertNotEqual(rgba[0, 2, :3].tolist(), [160, 160, 160])

    def test_allocation_style_preserves_continuous_values(self) -> None:
        destination = np.asarray([[np.nan, 0.0, 0.5, 1.0]], dtype=np.float32)

        rgba = _style_destination(destination, "allocation")

        self.assertIsNotNone(rgba)
        assert rgba is not None
        self.assertEqual(rgba[0, 0].tolist(), [0, 0, 0, 0])
        self.assertGreater(int(rgba[0, 3, 3]), int(rgba[0, 1, 3]))

    def test_priority_style_preserves_continuous_values(self) -> None:
        destination = np.asarray([[np.nan, 0.0, 0.5, 1.0]], dtype=np.float32)

        rgba = _style_destination(destination, "priority")

        self.assertIsNotNone(rgba)
        assert rgba is not None
        self.assertEqual(rgba[0, 0].tolist(), [0, 0, 0, 0])
        self.assertGreater(int(rgba[0, 3, 3]), int(rgba[0, 1, 3]))

    def test_canonical_allocation_surface_is_not_thresholded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            planning = root / "planning.parquet"
            pq.write_table(
                pa.table(
                    {
                        "variable_index": np.asarray([0, 1, 2], dtype=np.int32),
                        "row": np.asarray([0, 0, 1], dtype=np.int32),
                        "col": np.asarray([0, 1, 0], dtype=np.int32),
                    }
                ),
                planning,
            )

            canonical = write_solver_canonical_zarr(
                root / "allocation.zarr",
                [planning],
                np.asarray([0.25, 0.5, 1.0], dtype=np.float64),
                height=2,
                width=2,
                chunk_size=2,
                transform=Affine.identity().to_gdal(),
                crs="EPSG:3857",
                planning_unit_resolution=30,
                grid_family_id="test-grid",
                grid_level=1,
                surface="allocation",
            )
            values = zarr.open_group(str(canonical), mode="r")["allocation"][:]

            np.testing.assert_allclose(
                values[0, :2], np.asarray([0.25, 0.5], dtype=np.float32)
            )
            self.assertTrue(np.isnan(values[1, 1]))

    def test_canonical_priority_surface_uses_mean_overviews(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            planning = root / "planning.parquet"
            pq.write_table(
                pa.table(
                    {
                        "variable_index": np.arange(4, dtype=np.int32),
                        "row": np.asarray([0, 0, 1, 1], dtype=np.int32),
                        "col": np.asarray([0, 1, 0, 1], dtype=np.int32),
                    }
                ),
                planning,
            )

            canonical = write_solver_canonical_zarr(
                root / "priority.zarr",
                [planning],
                np.asarray([1.0, 0.5, 0.25, 0.0], dtype=np.float64),
                height=1026,
                width=2,
                chunk_size=2,
                transform=Affine.identity().to_gdal(),
                crs="EPSG:3857",
                planning_unit_resolution=30,
                grid_family_id="test-grid",
                grid_level=1,
                surface="priority",
            )
            group = zarr.open_group(str(canonical), mode="r")

            self.assertEqual("priority", group.attrs["surface"])
            np.testing.assert_allclose(
                group["priority"][0, :2],
                np.asarray([1.0, 0.5], dtype=np.float32),
            )
            self.assertTrue(np.isnan(group["priority"][2, 0]))
            self.assertEqual(
                "mean_priority_v1",
                group["overviews"]["2"].attrs["overview_statistic"],
            )
            self.assertAlmostEqual(float(group["overviews"]["2"][0, 0]), 0.4375)

    def test_priority_pmtiles_metadata_identifies_surface(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            canonical = self._canonical(root)
            group = zarr.open_group(str(canonical), mode="a")
            del group["decision"]
            group.create_dataset(
                "priority",
                data=np.ones((64, 64), dtype=np.float32),
                chunks=(32, 32),
                fill_value=np.nan,
            )
            group.attrs["surface"] = "priority"
            rendered = self._render(canonical, root / "priority.pmtiles", 2)

            source, reader = self._reader(rendered)
            try:
                metadata = reader.metadata()
                self.assertEqual("priority", metadata["surface"])
                self.assertEqual("mean_priority_v1", metadata["overview_statistic"])
                self.assertEqual(
                    "priority_magma_continuous_v1",
                    metadata["color_ramp"],
                )
            finally:
                source.close()

    def test_unselected_only_domain_still_produces_grey_tiles(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            canonical = self._canonical(root)
            zarr.open_group(str(canonical), mode="a")["decision"][:] = 0
            rendered = self._render(canonical, root / "unselected.pmtiles", 2)

            source, reader = self._reader(rendered)
            try:
                tile = reader.get(2, 1, 1)
                self.assertIsNotNone(tile)
                assert tile is not None
                pixels = np.asarray(Image.open(io.BytesIO(tile)).convert("RGBA"))
                self.assertTrue(np.any(np.all(pixels == [160, 160, 160, 180], axis=2)))
                self.assertFalse(reader.metadata()["empty"])
                self.assertEqual(4, reader.metadata()["rendered_tile_count"])
            finally:
                source.close()

    def test_render_plan_assigns_each_destination_tile_once(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            canonical = self._canonical(Path(directory))
            _, batches = prepare_windowed_pmtiles(
                canonical,
                min_zoom=2,
                max_zoom=2,
                tile_size=32,
                metatile_size=2,
            )
            owned = [
                (batch.zoom, x, y)
                for batch in batches
                for x in range(batch.x_start, batch.x_stop)
                for y in range(batch.y_start, batch.y_stop)
            ]
            self.assertEqual(len(owned), len(set(owned)))
            self.assertEqual(4, len(owned))

    def test_merge_fan_in_does_not_change_archive_identity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            canonical = self._canonical(root)
            specification, batches = prepare_windowed_pmtiles(
                canonical,
                min_zoom=2,
                max_zoom=2,
                tile_size=32,
                metatile_size=1,
                png_compress_level=3,
            )
            runs = []
            for index, batch in enumerate(batches):
                run = root / "runs" / f"{index}.tiles"
                render_windowed_pmtiles_batch(specification, batch, run)
                runs.append(run)

            narrow = finalize_windowed_pmtiles(
                specification,
                runs,
                root / "fan-in-2.pmtiles",
                maximum_merge_fan_in=2,
            )
            wide = finalize_windowed_pmtiles(
                specification,
                runs,
                root / "fan-in-64.pmtiles",
                maximum_merge_fan_in=64,
            )

            self.assertEqual(narrow.read_bytes(), wide.read_bytes())


if __name__ == "__main__":
    unittest.main()
