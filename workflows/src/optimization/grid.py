from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterator


GRID_FAMILY_ID = "bc_albers_30m_v1"
GRID_RESOLUTIONS = (30, 60, 120, 240, 480, 960, 1920)


@dataclass(frozen=True)
class GridTile:
    """One deterministic two-dimensional planning-grid work unit."""

    tile_id: str
    row_start: int
    row_stop: int
    col_start: int
    col_stop: int

    @property
    def shape(self) -> tuple[int, int]:
        """Return this tile's bounded array shape."""
        return self.row_stop - self.row_start, self.col_stop - self.col_start

    def to_dict(self) -> dict[str, int | str]:
        """Serialize the tile for a durable inventory manifest."""
        return asdict(self)


def grid_level(resolution: int) -> int:
    """Return the immutable power-of-two level for a supported resolution."""
    try:
        return GRID_RESOLUTIONS.index(resolution)
    except ValueError as error:
        supported = ", ".join(str(value) for value in GRID_RESOLUTIONS)
        raise ValueError(
            f"Unsupported planning-unit resolution {resolution} m; "
            f"supported levels are {supported} m."
        ) from error


def grid_cell_ids(rows: "object", cols: "object", grid_width: int) -> "object":
    """Vectorize the stable row-major uint64 cell identity."""
    import numpy as np

    if grid_width <= 0:
        raise ValueError("grid_width must be positive.")
    row_values = np.asarray(rows, dtype=np.uint64)
    col_values = np.asarray(cols, dtype=np.uint64)
    if np.any(col_values >= np.uint64(grid_width)):
        raise ValueError("A column lies outside the declared grid width.")
    return row_values * np.uint64(grid_width) + col_values


def iter_grid_tiles(
    height: int, width: int, tile_size: int, tile_width: int | None = None
) -> Iterator[GridTile]:
    """Yield deterministic row-major square tiles without full-width strips."""
    resolved_tile_width = tile_width or tile_size
    if min(height, width, tile_size, resolved_tile_width) <= 0:
        raise ValueError("height, width, and tile dimensions must be positive.")
    for row_start in range(0, height, tile_size):
        for col_start in range(0, width, resolved_tile_width):
            row_stop = min(row_start + tile_size, height)
            col_stop = min(col_start + resolved_tile_width, width)
            yield GridTile(
                tile_id=f"r{row_start:09d}-c{col_start:09d}",
                row_start=row_start,
                row_stop=row_stop,
                col_start=col_start,
                col_stop=col_stop,
            )
