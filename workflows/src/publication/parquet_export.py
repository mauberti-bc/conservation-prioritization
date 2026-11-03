from __future__ import annotations

from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import zarr

from ..optimization.grid import grid_cell_ids


def export_selected_parquet(
    canonical_path: str | Path, output_path: str | Path
) -> Path:
    """Stream selected canonical cells to an optional numeric Parquet export."""
    root = zarr.open_group(str(canonical_path), mode="r")
    decision = root["decision"]
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    metadata = {
        b"schema_version": b"1",
        b"grid_family_id": str(root.attrs["grid_family_id"]).encode(),
        b"grid_level": str(root.attrs["grid_level"]).encode(),
        b"crs": str(root.attrs["crs"]).encode(),
        b"planning_unit_resolution": str(
            root.attrs["planning_unit_resolution"]
        ).encode(),
    }
    writer: pq.ParquetWriter | None = None
    try:
        chunk_height, chunk_width = decision.chunks
        for row_start in range(0, decision.shape[0], chunk_height):
            for col_start in range(0, decision.shape[1], chunk_width):
                block = np.asarray(
                    decision[
                        row_start : min(row_start + chunk_height, decision.shape[0]),
                        col_start : min(col_start + chunk_width, decision.shape[1]),
                    ]
                )
                local_rows, local_cols = np.where(block == 1)
                if not len(local_rows):
                    continue
                rows = local_rows.astype(np.int64) + row_start
                cols = local_cols.astype(np.int64) + col_start
                stable_rows = rows + int(root.attrs["global_row_offset"])
                stable_cols = cols + int(root.attrs["global_col_offset"])
                table = pa.table(
                    {
                        "grid_cell_id": pa.array(
                            grid_cell_ids(
                                stable_rows,
                                stable_cols,
                                int(root.attrs["full_grid_width"]),
                            ),
                            type=pa.uint64(),
                        ),
                        "row": rows.astype(np.int32),
                        "col": cols.astype(np.int32),
                        "decision_value": np.ones(len(rows), dtype=np.uint8),
                    }
                ).replace_schema_metadata(metadata)
                if writer is None:
                    writer = pq.ParquetWriter(
                        destination, table.schema, compression="zstd"
                    )
                writer.write_table(table)
    finally:
        if writer is not None:
            writer.close()
    if writer is None:
        empty = pa.table(
            {
                "grid_cell_id": pa.array([], type=pa.uint64()),
                "row": pa.array([], type=pa.int32()),
                "col": pa.array([], type=pa.int32()),
                "decision_value": pa.array([], type=pa.uint8()),
            }
        ).replace_schema_metadata(metadata)
        pq.write_table(empty, destination, compression="zstd")
    return destination
