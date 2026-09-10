import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
import zarr

from src.flows import task_export as task_export_module
from src.publication.geotiff_export import (
    canonical_surface,
    export_resource_admission,
    upload_geotiff_part,
    write_geotiff_parts,
)


class GeoTiffExportTest(unittest.TestCase):
    def test_write_geotiff_parts_preserves_canonical_surface_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = _write_canonical_zarr(Path(directory) / "canonical.zarr")
            output = Path(directory) / "parts"

            parts = write_geotiff_parts(
                export_id="export-1",
                canonical_path=root,
                output_directory=output,
            )

            self.assertEqual(1, len(parts))
            part = parts[0]
            self.assertEqual("decision_y000000_x000000.tif", part.filename)
            self.assertEqual(
                "task-exports/export-1/parts/decision_y000000_x000000.tif",
                part.object_key,
            )
            self.assertEqual(0, part.row_offset)
            self.assertEqual(0, part.column_offset)
            self.assertEqual(3, part.width)
            self.assertEqual(2, part.height)
            with rasterio.open(part.path) as dataset:
                self.assertEqual("EPSG:3005", dataset.crs.to_string())
                self.assertEqual((2, 3), dataset.shape)
                self.assertEqual(255, dataset.nodata)
                np.testing.assert_array_equal(
                    dataset.read(1),
                    np.array([[1, 0, 255], [0, 1, 255]], dtype=np.uint8),
                )

    def test_export_resource_admission_describes_bounded_part(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = _write_canonical_zarr(Path(directory) / "canonical.zarr")

            admission = export_resource_admission(root)

            self.assertEqual("accepted", admission["status"])
            self.assertEqual("bounded_geotiff_part_v1", admission["method"])
            self.assertEqual("decision", admission["surface"])
            self.assertEqual([2, 3], admission["shape"])

    def test_upload_geotiff_part_returns_persistable_file_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = _write_canonical_zarr(Path(directory) / "canonical.zarr")
            part = write_geotiff_parts(
                export_id="export-1",
                canonical_path=root,
                output_directory=Path(directory) / "parts",
            )[0]

            with patch(
                "src.publication.geotiff_export.get_object_store_config"
            ) as config:
                with patch("src.publication.geotiff_export.put_object") as put_object:
                    config.return_value.bucket = "exports"
                    metadata = upload_geotiff_part(
                        export_id="export-1",
                        task_run_id="run-1",
                        part=part,
                        surface="decision",
                    )

            put_object.assert_called_once()
            self.assertEqual(part.object_key, metadata["object_key"])
            self.assertEqual("image/tiff", metadata["content_type"])
            self.assertEqual(
                {"gdal": list(part.transform.to_gdal())},
                metadata["transform"],
            )
            self.assertEqual("EPSG:3005", metadata["metadata"]["crs"])
            self.assertEqual("decision", metadata["metadata"]["surface"])

    def test_canonical_surface_reads_surface_attribute(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = _write_canonical_zarr(Path(directory) / "canonical.zarr")

            self.assertEqual("decision", canonical_surface(root))


class TaskExportFlowTest(unittest.TestCase):
    def test_task_export_flow_records_files_before_ready_status(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            canonical_path = _write_canonical_zarr(Path(directory) / "canonical.zarr")
            responses = []

            def fake_internal_api_request(method: str, path: str, payload=None):
                responses.append((method, path, payload))
                if method == "GET":
                    return {
                        "export": {
                            "task_export_id": "export-1",
                            "source_artifact_id": "artifact-1",
                        },
                        "run": {
                            "task_run_id": "run-1",
                            "artifacts": [
                                {
                                    "artifact_id": "artifact-1",
                                    "status": "ready",
                                    "manifest": {"partitions": []},
                                }
                            ],
                        },
                    }
                return {"ok": True}

            with patch.object(
                task_export_module,
                "_download_canonical_zarr",
                return_value=canonical_path,
            ):
                with patch.object(task_export_module, "get_run_logger"):
                    with patch.object(
                        task_export_module,
                        "upload_geotiff_part",
                        return_value={
                            "part_index": 0,
                            "filename": "decision_y000000_x000000.tif",
                            "object_key": (
                                "task-exports/export-1/parts/"
                                "decision_y000000_x000000.tif"
                            ),
                            "content_type": "image/tiff",
                            "byte_size": 100,
                            "checksum": "checksum",
                            "row_offset": 0,
                            "column_offset": 0,
                            "width": 3,
                            "height": 2,
                            "transform": {"gdal": [0, 30, 0, 60, 0, -30]},
                            "metadata": {"surface": "decision"},
                        },
                    ):
                        with patch.object(
                            task_export_module,
                            "internal_api_request",
                            side_effect=fake_internal_api_request,
                        ):
                            with patch.object(
                                task_export_module,
                                "_export_scratch_directory",
                                return_value=Path(directory) / "scratch",
                            ):
                                with patch.object(
                                    task_export_module.flow_run,
                                    "id",
                                    "flow-run-1",
                                ):
                                    task_export_module.task_export.fn("export-1", 1)

            file_callbacks = [
                value
                for value in responses
                if value[1] == "/internal/export/export-1/file"
            ]
            ready_callbacks = [
                value
                for value in responses
                if value[1] == "/internal/export/export-1/status"
                and value[2]
                and value[2].get("status") == "ready"
            ]
            self.assertEqual(1, len(file_callbacks))
            self.assertEqual(1, len(ready_callbacks))
            self.assertLess(
                responses.index(file_callbacks[0]),
                responses.index(ready_callbacks[0]),
            )


def _write_canonical_zarr(path: Path) -> Path:
    root = zarr.open_group(str(path), mode="w")
    values = root.create_dataset(
        "decision",
        shape=(2, 3),
        chunks=(2, 3),
        dtype="u1",
        fill_value=255,
    )
    values[:] = np.array([[1, 0, 255], [0, 1, 255]], dtype=np.uint8)
    root.attrs.update(
        {
            "surface": "decision",
            "crs": "EPSG:3005",
            "transform": [0, 30, 0, 60, 0, -30],
        }
    )
    return path


if __name__ == "__main__":
    unittest.main()
