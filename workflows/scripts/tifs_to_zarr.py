"""Publish immutable native-resolution analytical Zarr layers from a manifest."""

import argparse
import json
from pathlib import Path

from src.source_publisher import SourceGrid, publish_analytical_source


def main() -> None:
    """Parse a publication specification and commit its manifest last."""
    parser = argparse.ArgumentParser()
    parser.add_argument("specification", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--tile-size", type=int, default=1024)
    arguments = parser.parse_args()
    specification = json.loads(arguments.specification.read_text(encoding="utf-8"))
    grid = None
    if specification.get("grid_extent"):
        grid = SourceGrid(
            crs=specification.get("crs", "EPSG:3005"),
            extent=tuple(specification["grid_extent"]),
            base_resolution=int(specification.get("base_resolution", 30)),
        )
    manifest = publish_analytical_source(
        specification["layers"],
        specification["layer_contracts"],
        arguments.output,
        source_name=specification["name"],
        source_version=specification["version"],
        grid=grid,
        tile_size=arguments.tile_size,
    )
    print(manifest)


if __name__ == "__main__":
    main()
