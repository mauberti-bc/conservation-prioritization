import json
from collections import (
    defaultdict,
)
from datetime import (
    datetime,
)
from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional,
    Sequence,
    Tuple,
)

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pulp
import xarray as xr
from affine import (
    Affine,
)
from morecantile import (
    defaults,
)
from morecantile.commons import (
    Tile,
)
from pmtiles.tile import (
    Compression,
    TileType,
    zxy_to_tileid,
)
from pmtiles.writer import (
    Writer,
)
from prefect import (
    get_run_logger,
    task,
)
from pulp import (
    LpStatus,
)

# Type Definitions
from pydantic import (
    BaseModel,
    Field,
    field_validator,
)
from pyproj import (
    Transformer,
)
from rasterio.enums import (
    Resampling,
)
from rasterio.features import (
    rasterize,
)
from rasterio.transform import (
    array_bounds,
)
from rio_tiler.io.xarray import (
    XarrayReader,
)
from scipy import (
    stats,
)
from shapely import (
    unary_union,
)
from shapely.geometry import (
    mapping,
    shape,
)
from shapely.geometry.base import (
    BaseGeometry,
)


class OptimizationConstraint(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    type: Optional[str] = None


class OptimizationLayer(BaseModel):
    mode: Literal["flexible", "locked-in", "locked-out"]
    importance: Optional[float] = None
    threshold: Optional[float] = None
    constraints: Optional[List[OptimizationConstraint]] = None


OptimizationLayers = Dict[str, OptimizationLayer]


class OptimizationParameters(BaseModel):
    geometry: Optional[Sequence[BaseGeometry]] = None
    resolution: int = Field(..., gt=0)
    resampling: Literal["mode", "min", "max"]
    layers: OptimizationLayers
    model_config = {
        "arbitrary_types_allowed": True,
    }

    @field_validator("geometry", mode="before")
    def convert_geojson_to_geometry(cls, v):
        if v is None:
            return None

        def extract_geometry(item):
            # Extract the geometry from a GeoJSON Feature if necessary
            if item.get("type") == "Feature":
                item = item["geometry"]
            return shape(item)

        # Single item
        if isinstance(v, dict):
            return [extract_geometry(v)]

        # List of items
        if isinstance(v, (list, tuple)):
            return [extract_geometry(item) for item in v]

        raise TypeError("geometry must be a GeoJSON geometry or list of them")


@task
def load_british_columbia_boundary(path: str) -> Sequence[BaseGeometry]:
    """
    Load and return a GeoSeries of geometries from the first layer of a GDB.
    This may include multiple Polygon or MultiPolygon features.
    """
    layers = gpd.list_layers(path)
    first_layer_name = str(layers.loc[0, "name"])
    gdf = gpd.read_file(path, layer=first_layer_name)

    return [gdf.geometry.union_all(method="coverage")]


@task
def load_input_data(
    zarr_path: str,
    layer_paths: List[str],  # e.g., ["cultural/protected_areas/conservancy"]
    resolution: int = 1000,
    resampling: Literal[
        "mode",
        "min",
        "max",
    ] = "mode",
    crs: Optional[int] = 3005,
    geometry: Optional[Sequence[BaseGeometry]] = None,
) -> Dict[str, xr.Dataset]:
    """
    Load and optionally process variables from a zarr store, grouped by Zarr group path.
    Each path must be in 'group/variable' form. Downsample factor is computed\
          as resolution / source_resolution.
    """
    group_vars = defaultdict(list)
    for path in layer_paths:
        if "/" not in path:
            raise ValueError(
                f"Invalid layer path: '{path}'. Must be in 'group/variable' format."
            )
        *group_parts, var = path.split("/")
        group_path = "/".join(group_parts)
        group_vars[group_path].append(var)

    result = {}

    for group_path, variables in group_vars.items():
        zarr_group = group_path if group_path else None  # Handle root group
        ds = xr.open_zarr(zarr_path, group=zarr_group, consolidated=True)

        # Get transform and resolution before spatial filtering (when ds still has data)
        original_transform = ds.rio.transform()

        # TODO: MULTIPOLYGONS should be efficiently processed separately;
        # each polygon should have its own bbox
        if geometry is not None:
            print(geometry, "geometry")
            unioned = unary_union(geometry)
            bounds = unioned.bounds  # (minx, miny, maxx, maxy)

            # Check y-coordinate ordering
            y_ascending = ds.y[0] < ds.y[-1]

            if y_ascending:
                # Y coordinates go from south to north (bottom to top)
                ds = ds.sel(
                    x=slice(bounds[0], bounds[2]),
                    y=slice(bounds[1], bounds[3]),  # miny to maxy
                )
            else:
                # Y coordinates go from north to south (top to bottom)
                ds = ds.sel(
                    x=slice(bounds[0], bounds[2]),
                    y=slice(bounds[3], bounds[1]),  # maxy to miny
                )

        # Calculate resolution once per group (using original transform)
        source_resolution_x = original_transform.a
        source_resolution_y = -original_transform.e

        if abs(source_resolution_x - source_resolution_y) > 1e-3:
            print(f"Warning: Non-square pixels detected in group '{group_path}'")

        source_resolution = (abs(source_resolution_x) + abs(source_resolution_y)) / 2
        downsample_factor = resolution / source_resolution

        # Pre-calculate coarsening parameters if needed
        needs_coarsening = downsample_factor > 1
        if needs_coarsening:
            factor = int(round(downsample_factor))
            new_transform = Affine(
                original_transform.a * factor,
                original_transform.b,
                original_transform.c,
                original_transform.d,
                original_transform.e * factor,
                original_transform.f,
            )

        processed_vars = {}
        empty_vars = []

        for var in variables:
            if var not in ds:
                raise KeyError(
                    f"No variable named '{var}' in group '{group_path}'. \
                        Found: {list(ds.data_vars)}"
                )
            da: xr.DataArray = ds[var]

            # Skip variable if there's no data after spatial filtering
            if da.x.size == 0 or da.y.size == 0:
                print(
                    f"Variable '{var}' in group '{group_path}' has no data in \
                        geometry — returning NaN array."
                )
                empty_vars.append(var)

                # For dummy arrays, we need to estimate what the shape
                # would be if there was data. We'll use the original full dataset
                # bounds and apply the same resolution logic

                # Get original dataset before any filtering
                # to determine expected output shape
                original_ds = xr.open_zarr(
                    zarr_path, group=zarr_group, consolidated=True
                )

                if geometry is not None:
                    unioned = unary_union(geometry)
                    bounds = unioned.bounds  # (minx, miny, maxx, maxy)

                    # Estimate grid size based on bounds and resolution
                    width = bounds[2] - bounds[0]  # max_x - min_x
                    height = bounds[3] - bounds[1]  # max_y - min_y

                    if needs_coarsening:
                        effective_resolution = source_resolution * factor
                    else:
                        effective_resolution = source_resolution

                    ncols = max(1, int(np.ceil(width / effective_resolution)))
                    nrows = max(1, int(np.ceil(height / effective_resolution)))

                    # Create coordinate arrays
                    if needs_coarsening:
                        transform_to_use = new_transform
                    else:
                        transform_to_use = original_transform

                    x_coords = (
                        np.arange(ncols) * transform_to_use.a
                        + transform_to_use.c
                        + bounds[0]
                    )
                    y_coords = (
                        np.arange(nrows) * transform_to_use.e
                        + transform_to_use.f
                        + bounds[3]
                    )

                else:
                    # No geometry filtering, use original dataset dimensions
                    if needs_coarsening:
                        nrows = len(original_ds.y) // factor
                        ncols = len(original_ds.x) // factor
                        transform_to_use = new_transform
                    else:
                        nrows = len(original_ds.y)
                        ncols = len(original_ds.x)
                        transform_to_use = original_transform

                    x_coords = (
                        np.arange(ncols) * transform_to_use.a + transform_to_use.c
                    )
                    y_coords = (
                        np.arange(nrows) * transform_to_use.e + transform_to_use.f
                    )

                coords = {"y": y_coords, "x": x_coords}

                dummy = xr.DataArray(
                    data=np.full((nrows, ncols), np.nan, dtype=float),
                    dims=("y", "x"),
                    coords=coords,
                    name=var,
                    attrs=da.attrs,  # optional: copy metadata
                )
                dummy = dummy.rio.write_crs(crs).rio.write_transform(transform_to_use)

                processed_vars[var] = dummy
                continue

            if needs_coarsening:
                coarsened = da.coarsen(x=factor, y=factor, boundary="pad")

                if resampling == "min":
                    da = coarsened.reduce(np.nanmin)
                elif resampling == "max":
                    da = coarsened.reduce(np.nanmax)
                elif resampling == "mode":

                    def nanmode(data, axis):
                        # Mask NaNs (scipy mode with nan_policy requires scipy >= 1.9)
                        if np.isnan(data).all(axis=axis).any():
                            # If all values are NaN along axis, return NaN
                            result = np.full(
                                data.shape[:axis] + data.shape[axis + 1 :], np.nan
                            )
                        else:
                            mode_result = stats.mode(
                                data, axis=axis, nan_policy="omit", keepdims=False
                            )
                            result = mode_result.mode
                        return result

                    da = coarsened.reduce(nanmode)
                else:
                    raise ValueError(f"Unsupported resampling method: {resampling}")

                da = da.rio.write_crs(crs).rio.write_transform(new_transform)
            else:
                da = da.rio.write_crs(crs).rio.write_transform(original_transform)

            processed_vars[var] = da

        # Check if all variables in this group have no data
        if len(empty_vars) == len(variables):
            raise ValueError(
                f"All variables in group '{group_path}' have no data\
                      after spatial filtering. "
                f"Variables: {variables}. Check your geometry bounds."
            )

        # Warn if some (but not all) variables are empty
        if empty_vars:
            print(
                f"Warning: {len(empty_vars)}/{len(variables)} variables in \
                    group '{group_path}' "
                f"have no data after spatial filtering: {empty_vars}"
            )

        result[group_path] = xr.Dataset(processed_vars)

    return result


@task
def create_boolean_masks(
    reference_array: xr.DataArray,
    bounds: Sequence[BaseGeometry],
) -> Tuple[np.ndarray, int, int, Any]:
    """
    Generate a boolean geometry mask for valid optimization area.
    Args:
        reference_array: An xarray.DataArray with spatial coordinates.
        bounds: A sequence of geometries (Polygon, MultiPolygon, etc.) to rasterize.
    Returns:
        - valid_mask: Boolean mask where optimization is allowed.
        - nrows: Number of rows in the grid.
        - ncols: Number of columns in the grid.
        - transform: Affine transform from reference data layer.
    """
    nrows, ncols = reference_array.shape
    transform = reference_array.rio.transform()

    # Convert sequence to list for consistent handling
    geoms = list(bounds)

    geometry_mask = rasterize(
        [(mapping(geom), 1) for geom in geoms],
        out_shape=(nrows, ncols),
        transform=transform,
        fill=0,
        dtype=np.uint8,
    )
    print("MASK", geometry_mask)
    geometry_mask = geometry_mask.astype(bool)
    return geometry_mask, nrows, ncols, transform


@task
def build_pulp_model(
    dataset: Dict[str, xr.Dataset],  # Updated type hint
    conditions: OptimizationLayers,
    valid_mask: np.ndarray,
) -> Tuple[pulp.LpProblem, Dict[Tuple[int, int], pulp.LpVariable]]:
    prob = pulp.LpProblem("ConservationOptimization", pulp.LpMaximize)
    nrows, ncols = valid_mask.shape

    # Create decision variables for all valid cells
    valid_rows, valid_cols = np.where(valid_mask)
    cell_indices = list(zip(valid_rows, valid_cols, strict=False))

    decision_vars = {
        (r, c): pulp.LpVariable(f"x_{r}_{c}", cat="Binary") for r, c in cell_indices
    }

    print(f"DEBUG: Total decision variables created: {len(decision_vars)}")
    print(f"DEBUG: Grid shape: {nrows}x{ncols}")
    print(f"DEBUG: Valid mask cells: {np.sum(valid_mask)}")

    # Build objective function
    objective_terms = []
    for layer_name, props in conditions.items():
        mode = props.mode
        importance = props.importance

        if mode != "flexible" or importance == 0 or importance is None:
            continue

        # ✅ FIXED: split group and variable properly
        *group_parts, var = layer_name.split("/")
        group = "/".join(group_parts)

        if group not in dataset:
            raise ValueError(
                f"Group '{group}' not found in dataset \
                    for layer '{layer_name}'. "
                f"Available groups: {list(dataset.keys())}"
            )

        if var not in dataset[group]:
            raise ValueError(
                f"Variable '{var}' not found in group '{group}' for\
                      layer '{layer_name}'. "
                f"Available variables: {list(dataset[group].data_vars.keys())}"
            )

        print(dataset)
        print("LAYER NAME", layer_name)

        arr = dataset[group][var].values

        # Vectorized objective creation
        for r, c in cell_indices:
            val = arr[r, c]
            if not np.isnan(val):
                objective_terms.append(importance * val * decision_vars[(r, c)])
            else:
                print("Val is all nan: ", val)

    print("OBJECTIVE TERMS@", objective_terms)

    if objective_terms:
        prob += pulp.lpSum(objective_terms), "WeightedObjective"
    else:
        prob += pulp.lpSum(decision_vars.values()), "DummyObjective"
        print("WARNING: No objective terms found, using dummy objective")

    # Add constraints
    for layer_name, props in conditions.items():
        # ✅ FIXED: split group and variable properly
        *group_parts, var = layer_name.split("/")
        group = "/".join(group_parts)

        if group not in dataset:
            raise ValueError(
                f"Group '{group}' not found in dataset for layer '{layer_name}'. "
                f"Available groups: {list(dataset.keys())}"
            )

        if var not in dataset[group]:
            raise ValueError(
                f"Variable '{var}' not found in group '{group}' for layer \
                    '{layer_name}'. "
                f"Available variables: {list(dataset[group].data_vars.keys())}"
            )

        arr = dataset[group][var].values
        mode = props.mode
        constraints = props.constraints or []

        print(f"\nDEBUG: Processing layer '{layer_name}'")
        print(f"Mode: {mode}")
        print(f"Array shape: {arr.shape}")
        print(f"Non-NaN values: {np.sum(~np.isnan(arr))}")
        print(f"Min/Max values: {np.nanmin(arr):.3f} / {np.nanmax(arr):.3f}")

        # Handle locking constraints - FIXED: using hyphenated versions
        if mode == "locked-in":
            threshold = props.threshold
            if threshold is None:
                raise ValueError(
                    f"Threshold required for locked-in mode on layer '{layer_name}'"
                )

            locked_cells = [
                (r, c)
                for r, c in cell_indices
                if not np.isnan(arr[r, c]) and arr[r, c] >= threshold
            ]

            if locked_cells:
                # Add all locked_in constraints at once
                locked_vars = [decision_vars[(r, c)] for r, c in locked_cells]
                for var in locked_vars:
                    prob += var == 1

            print(f"Locked in: {len(locked_cells)} variables")

        elif mode == "locked-out":
            threshold = props.threshold
            if threshold is None:
                raise ValueError(
                    f"Threshold required for locked-out mode on layer '{layer_name}'"
                )

            # Use np.where to find cells that should be locked out
            # Only consider cells that are in valid_mask
            # AND meet the threshold condition
            locked_out_mask = valid_mask & (~np.isnan(arr)) & (arr > threshold)
            locked_rows, locked_cols = np.where(locked_out_mask)

            # Add constraints for all locked out cells
            for r, c in zip(locked_rows, locked_cols, strict=False):
                if (r, c) in decision_vars:  # Safety check
                    prob += decision_vars[(r, c)] == 0

            print(f"Locked out: {len(locked_rows)} variables")

            # Optional: Show some stats for debugging
            print(
                f"Total cells > threshold:\
                      {np.sum((arr > threshold) & (~np.isnan(arr)))}"
            )
            print(f"Valid cells > threshold: {len(locked_rows)}")
            print(f"Threshold: {threshold}")
            print(f"Array range: [{np.nanmin(arr):.3f}, {np.nanmax(arr):.3f}]")

        # Handle value constraints
        for constr in constraints:
            min_val = constr.min
            max_val = constr.max
            typ = constr.type

            # Create constraint terms for valid cells
            valid_cells = [(r, c) for r, c in cell_indices if not np.isnan(arr[r, c])]

            if not valid_cells:
                print(
                    f"WARNING: No valid values for constraint on layer '{layer_name}'"
                )
                continue

            # Build sum expression
            constraint_terms = [
                arr[r, c] * decision_vars[(r, c)] for r, c in valid_cells
            ]
            total_sum = pulp.lpSum(constraint_terms)

            if typ == "percent":
                total_possible = sum(arr[r, c] for r, c in valid_cells)
                print(f"Constraint (percent): total_possible = {total_possible:.3f}")

                if total_possible == 0:
                    print(
                        f"WARNING: Total possible value is 0 for layer '{layer_name}'"
                    )
                    continue

                if min_val is not None:
                    prob += total_sum >= (min_val / 100) * total_possible
                    print(f"Added: total_sum >= {(min_val / 100) * total_possible:.3f}")

                if max_val is not None:
                    prob += total_sum <= (max_val / 100) * total_possible
                    print(f"Added: total_sum <= {(max_val / 100) * total_possible:.3f}")

            else:  # unit constraint
                total_possible = sum(arr[r, c] for r, c in valid_cells)
                print(f"Constraint (unit): total_possible = {total_possible:.3f}")

                if min_val is not None:
                    prob += total_sum >= min_val
                    print(f"Added: total_sum >= {min_val}")

                if max_val is not None:
                    prob += total_sum <= max_val
                    print(f"Added: total_sum <= {max_val}")

    print(f"\nDEBUG: Final objective terms: {len(objective_terms)}")
    print(f"DEBUG: Total constraints added: {len(prob.constraints)}")

    return prob, decision_vars


@task
def solve_lp(prob: pulp.LpProblem) -> pulp.LpProblem:
    prob.solve()
    print("Status:", LpStatus[prob.status])
    return prob


@task
def extract_solution(
    cell_vars: Dict[Tuple[int, int], pulp.LpVariable],
    nrows: int,
    ncols: int,
    geometry: Sequence[BaseGeometry],
    transform,
) -> np.ndarray:
    selection = np.zeros((nrows, ncols), dtype=float)
    for (i, j), var in cell_vars.items():
        selection[i, j] = float(var.varValue) if var.varValue is not None else 0.0

    geometry_mask = rasterize(
        [(mapping(geom), 1) for geom in geometry],
        out_shape=(nrows, ncols),
        transform=transform,
        fill=0,
        dtype=np.uint8,
    )

    return np.where(geometry_mask == 1, selection, 0)


@task
def prepare_dataset(
    zarr_path: str,  # path to root of Zarr store
    layer_names: List[str],  # e.g., ["disturbance/roads", "species/moose"]
    downsample_factor: int = 25,
    crs: int = 3005,
) -> Dict[str, xr.Dataset]:
    group_map = defaultdict(list)
    for layer in layer_names:
        group, var = layer.split("/", 1)
        group_map[group].append(var)

    processed_groups = {}

    for group, variables in group_map.items():
        # Open that group of the Zarr store
        group_ds = xr.open_zarr(zarr_path, group=group, consolidated=True)

        # Process variables in the group
        processed_vars = {}
        for var in variables:
            da = group_ds[var]
            da = da.coarsen(
                x=downsample_factor, y=downsample_factor, boundary="pad"
            ).mean(skipna=True)
            da = da.rio.write_crs(crs)
            processed_vars[var] = da

        processed_groups[group] = xr.Dataset(processed_vars)

    return processed_groups


@task
def visualize(solution: np.ndarray):
    plt.figure(figsize=(12, 12))
    plt.title("Selected Conservation Areas")
    im = plt.imshow(solution, cmap="viridis")
    plt.colorbar(im)
    plt.tight_layout()
    plt.savefig(f"/data/outputs/{datetime.now().strftime('%Y%m%dT%H%M%S')}.png")
    plt.show()


@task
def create_pmtiles_archive(
    array: np.ndarray,
    transform: Affine,
    crs: str,
    out_path: str,
    min_zoom: int = 0,
    max_zoom: int = 12,
    tile_size: int = 512,
):
    """
    Create a PMTiles archive from a 2D numpy array using Web Mercator tiles,
    strictly limited to the extent of the input transform.
    """
    logger = get_run_logger()

    if array.ndim != 2:
        raise ValueError("Input array must be 2D.")

    height, width = array.shape
    bounds = array_bounds(height, width, transform)
    logger.info(f"Input bounds in CRS {crs}: {bounds}")

    # Set up xarray with correct coordinates
    x_coords = np.linspace(bounds[0], bounds[2], width)
    y_coords = np.linspace(bounds[3], bounds[1], height)  # flip Y axis

    uint8_array = (array * 255).astype(np.uint8)
    da = xr.DataArray(
        uint8_array,
        dims=("y", "x"),
        coords={"x": x_coords, "y": y_coords},
        attrs={"_FillValue": 0},
    )
    da.rio.write_crs(crs, inplace=True)
    da.rio.write_transform(transform, inplace=True)

    # Reproject to Web Mercator (EPSG:3857)
    da_web = da.rio.reproject("EPSG:3857", resampling=Resampling.bilinear)
    wm_bounds = tuple(map(float, da_web.rio.bounds()))
    logger.info(f"Reprojected bounds (EPSG:3857): {wm_bounds}")

    # Prepare transformer for tile bound conversion (4326 -> 3857)
    to_webmercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    to_latlon = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

    # Convert reprojected bounds to EPSG:4326 to use in tms.tile()
    minx, miny, maxx, maxy = wm_bounds
    min_lon, min_lat = to_latlon.transform(minx, miny)
    max_lon, max_lat = to_latlon.transform(maxx, maxy)

    tms = defaults.tms.get("WebMercatorQuad")
    tiles_written = 0

    with open(out_path, "wb") as f, XarrayReader(input=da_web, tms=tms) as reader:
        writer = Writer(f)

        for z in range(min_zoom, max_zoom + 1):
            ul = tms.tile(min_lon, max_lat, z)
            lr = tms.tile(max_lon, min_lat, z)

            logger.info(f"Zoom {z}: Tiles from ({ul.x},{ul.y}) to ({lr.x},{lr.y})")

            for x in range(ul.x, lr.x + 1):
                for y in range(ul.y, lr.y + 1):
                    tile = Tile(x=x, y=y, z=z)

                    # Get tile bounds in EPSG:4326, then convert to EPSG:3857
                    tile_bounds_4326 = tms.bounds(tile)
                    left, bottom = to_webmercator.transform(
                        tile_bounds_4326.left, tile_bounds_4326.bottom
                    )
                    right, top = to_webmercator.transform(
                        tile_bounds_4326.right, tile_bounds_4326.top
                    )

                    # Skip if tile doesn't intersect with our EPSG:3857 bounds
                    if (
                        right < wm_bounds[0]
                        or left > wm_bounds[2]
                        or top < wm_bounds[1]
                        or bottom > wm_bounds[3]
                    ):
                        logger.warning(f"Skipping out-of-bounds tile: {tile}")
                        continue

                    tile_data = reader.tile(x, y, z, tilesize=tile_size)

                    # Skip fully masked tiles (no data)
                    if hasattr(tile_data.array, "mask") and tile_data.array.mask.all():
                        logger.warning(f"Skipping empty tile: {tile}")
                        continue

                    # Encode tile and write
                    colormap = {
                        i: (255, 0, 0, 170) if i > 0 else (0, 0, 0, 0)
                        for i in range(256)
                    }
                    tile_bytes = tile_data.render(img_format="PNG", colormap=colormap)
                    tile_id = zxy_to_tileid(z, x, y)
                    writer.write_tile(tile_id, tile_bytes)
                    tiles_written += 1

                    if tiles_written % 100 == 0:
                        logger.info(f"{tiles_written} tiles written...")

        if tiles_written == 0:
            raise RuntimeError(
                "No tiles generated. Check input bounds and zoom levels."
            )

        logger.info(f"Finished writing {tiles_written} tiles.")

        # Finalize PMTiles archive
        metadata = {
            "format": "png",
            "bounds": list(wm_bounds),
            "center": [
                (wm_bounds[0] + wm_bounds[2]) / 2,
                (wm_bounds[1] + wm_bounds[3]) / 2,
                min_zoom,
            ],
            "tilejson": "2.2.0",
            "type": "overlay",
            "name": "Generated Tiles",
            "minzoom": min_zoom,
            "maxzoom": max_zoom,
        }

        writer.finalize(
            header={
                "tile_compression": Compression.NONE,
                "tile_type": TileType.PNG,
                "min_zoom": min_zoom,
                "max_zoom": max_zoom,
            },
            metadata=json.dumps(metadata),
        )

        logger.info(f"PMTiles archive created: {out_path}")


def resolution_to_max_zoom(
    resolution: int,
    min_res: int = 30,
    max_res: int = 5000,
    min_zoom: int = 7,
    max_zoom: int = 13,
) -> int:
    # Clamp the resolution to expected range
    res = np.clip(resolution, min_res, max_res)

    # Normalize: 0 (high detail) → 1 (low detail)
    t = (np.log(res) - np.log(min_res)) / (np.log(max_res) - np.log(min_res))

    # Invert and scale to zoom range
    zoom = max_zoom - t * (max_zoom - min_zoom)

    return int(round(zoom))
