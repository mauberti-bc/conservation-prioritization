import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pulp
import xarray as xr
from affine import Affine
from morecantile import defaults
from morecantile.commons import Tile
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from prefect import get_run_logger, task
from pulp import LpStatus
from pydantic import BaseModel, Field, field_validator
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import array_bounds
from rio_tiler.io.xarray import XarrayReader
from scipy import stats
from shapely import GeometryCollection, MultiLineString, MultiPolygon, unary_union
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry


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
    """
    Parameters for conservation optimization.

    Attributes:
        geometry: Optional geometries to constrain the analysis area
        resolution: Output resolution in meters (must be > 0)
        resampling: How to resample input data ("mode", "min", "max")
        layers: Dictionary of layers with optimization properties
        target_area: Either:
            - A percentage (0-100) if is_percentage=True
            - An absolute number of cells if is_percentage=False
            Default: 50 (50% of valid cells)
        is_percentage: Whether target_area is a percentage or absolute count
            Default: True
    """

    geometry: Optional[Sequence[BaseGeometry]] = None
    resolution: int = Field(..., gt=0)
    resampling: Literal["mode", "min", "max"]
    layers: OptimizationLayers
    target_area: float = Field(default=50.0, ge=0)
    is_percentage: bool = Field(default=True)

    class Config:
        arbitrary_types_allowed = True

    @field_validator("geometry", mode="before")
    def convert_geojson_to_geometry(cls, v):
        if v is None:
            return None

        def extract_geometry(item):
            geojson = item.get("geojson") if isinstance(item, dict) else None
            if geojson is None:
                raise ValueError("Each geometry item must have a 'geojson' key")
            geom_dict = geojson.get("geometry")
            if geom_dict is None:
                raise ValueError("geojson must contain a 'geometry' field")
            return shape(geom_dict)

        if isinstance(v, dict):
            return [extract_geometry(v)]
        elif isinstance(v, (list, tuple)):
            return [extract_geometry(item) for item in v]

        raise TypeError("geometry must be a dict or list/tuple of dicts with geojson")

    @field_validator("target_area")
    @classmethod
    def validate_target_area(cls, v, info):
        is_percentage = info.data.get("is_percentage", True)
        if is_percentage and (v < 0 or v > 100):
            raise ValueError(
                "target_area must be between 0-100 when is_percentage=True"
            )
        if not is_percentage and v < 0:
            raise ValueError("target_area must be >= 0 when is_percentage=False")
        return v


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
    layer_paths: List[str],
    resolution: int = 1000,
    resampling: Literal["mode", "min", "max"] = "mode",
    crs: Optional[int] = 3005,
    geometry: Optional[Sequence[BaseGeometry]] = None,
) -> Dict[str, xr.Dataset]:
    """
    Load and optionally process variables from a zarr store, grouped by Zarr group path.
    Each path must be in 'group/variable' form.
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
        zarr_group = group_path if group_path else None
        ds = xr.open_zarr(zarr_path, group=zarr_group, consolidated=True)

        # Get transform from the first variable (DataArray)
        first_var = variables[0]
        if first_var not in ds:
            raise KeyError(
                f"No variable named '{first_var}' in group '{group_path}'. Found: {list(ds.data_vars)}"
            )

        original_transform = ds[first_var].rio.transform()

        if geometry is not None:
            # FIX: Ensure geometry is properly handled as a sequence of BaseGeometry
            geom_union: BaseGeometry = unary_union(list(geometry))
            bounds = geom_union.bounds

            y_ascending = ds.y[0] < ds.y[-1]

            if y_ascending:
                ds = ds.sel(
                    x=slice(bounds[0], bounds[2]),
                    y=slice(bounds[1], bounds[3]),
                )
            else:
                ds = ds.sel(
                    x=slice(bounds[0], bounds[2]),
                    y=slice(bounds[3], bounds[1]),
                )

        source_resolution_x = original_transform.a
        source_resolution_y = -original_transform.e

        if abs(source_resolution_x - source_resolution_y) > 1e-3:
            print(f"Warning: Non-square pixels detected in group '{group_path}'")

        source_resolution = (abs(source_resolution_x) + abs(source_resolution_y)) / 2
        downsample_factor = resolution / source_resolution

        needs_coarsening = downsample_factor > 1
        new_transform = None  # FIX: Initialize to None for type safety
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

        processed_vars: Dict[str, xr.DataArray] = {}
        empty_vars: List[str] = []

        for var in variables:
            if var not in ds:
                raise KeyError(
                    f"No variable named '{var}' in group '{group_path}'. Found: {list(ds.data_vars)}"
                )
            da: xr.DataArray = ds[var]

            if da.x.size == 0 or da.y.size == 0:
                print(
                    f"Variable '{var}' in group '{group_path}' has no data in geometry — returning NaN array."
                )
                empty_vars.append(var)

                original_ds = xr.open_zarr(
                    zarr_path, group=zarr_group, consolidated=True
                )

                if geometry is not None:
                    geom_union = unary_union(list(geometry))
                    bounds = geom_union.bounds

                    width = bounds[2] - bounds[0]
                    height = bounds[3] - bounds[1]

                    if needs_coarsening and new_transform is not None:
                        effective_resolution = source_resolution * factor
                    else:
                        effective_resolution = source_resolution

                    ncols = max(1, int(np.ceil(width / effective_resolution)))
                    nrows = max(1, int(np.ceil(height / effective_resolution)))

                    if needs_coarsening and new_transform is not None:
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
                    if needs_coarsening:
                        assert new_transform is not None  # Type guard
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
                    attrs=da.attrs,
                )
                dummy = dummy.rio.write_crs(crs).rio.write_transform(transform_to_use)

                processed_vars[var] = dummy
                continue

            if needs_coarsening:
                assert new_transform is not None  # Type guard
                factor = int(round(downsample_factor))
                coarsened = da.coarsen(x=factor, y=factor, boundary="pad")

                if resampling == "min":
                    da = coarsened.reduce(np.nanmin)
                elif resampling == "max":
                    da = coarsened.reduce(np.nanmax)
                elif resampling == "mode":

                    def nanmode(data: np.ndarray, axis: int) -> np.ndarray:
                        if np.isnan(data).all(axis=axis).any():
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

        if len(empty_vars) == len(variables):
            raise ValueError(
                f"All variables in group '{group_path}' have no data after spatial filtering. "
                f"Variables: {variables}. Check your geometry bounds."
            )

        if empty_vars:
            print(
                f"Warning: {len(empty_vars)}/{len(variables)} variables in group '{group_path}' "
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
        reference_array: DataArray with rio accessor (must have CRS set)
        bounds: Sequence of geometries defining the valid area

    Returns:
        Tuple of (geometry_mask, nrows, ncols, transform)
    """
    # Ensure reference_array has rio accessor and CRS
    if not hasattr(reference_array, "rio"):
        raise ValueError("reference_array must have rio accessor (import rioxarray)")

    if reference_array.rio.crs is None:
        reference_array = reference_array.rio.write_crs("EPSG:3005")

    nrows, ncols = reference_array.shape
    transform: Affine = reference_array.rio.transform()

    # bounds should be an iterable of BaseGeometry objects
    geoms: List[BaseGeometry] = list(bounds)

    if not geoms:
        raise ValueError("bounds sequence is empty")

    # Correctly rasterize the geometries passed in 'bounds'
    geometry_mask: np.ndarray = rasterize(
        [(mapping(geom), 1) for geom in geoms],
        out_shape=(nrows, ncols),
        transform=transform,
        fill=0,
        dtype=np.uint8,
    )

    geometry_mask = geometry_mask.astype(bool)
    return geometry_mask, nrows, ncols, transform


@task
def build_pulp_model(
    dataset: Dict[str, xr.Dataset],
    conditions: OptimizationLayers,
    valid_mask: np.ndarray,
    target_area: float = 50.0,
    is_percentage: bool = True,
) -> Tuple[pulp.LpProblem, Dict[Tuple[int, int], pulp.LpVariable]]:
    """
    Build a PuLP optimization model that selects cells based on layer conditions.

    Args:
        dataset: Dictionary of xarray Datasets grouped by layer path
        conditions: OptimizationLayers with mode, importance, threshold, constraints
        valid_mask: Boolean mask of valid cells
        target_area: Target selection area (percentage or absolute count)
        is_percentage: Whether target_area is a percentage (True) or absolute count (False)

    Returns:
        Tuple of (solved problem, decision variables dict)
    """
    logger = get_run_logger()

    prob = pulp.LpProblem("ConservationOptimization", pulp.LpMaximize)
    nrows, ncols = valid_mask.shape

    # Create decision variables for all valid cells
    valid_rows, valid_cols = np.where(valid_mask)
    cell_indices = list(zip(valid_rows, valid_cols, strict=False))

    decision_vars = {
        (r, c): pulp.LpVariable(f"x_{r}_{c}", cat="Binary") for r, c in cell_indices
    }

    logger.info(f"Created {len(decision_vars)} decision variables")
    logger.info(f"Grid shape: {nrows}x{ncols}")
    logger.info(f"Valid mask cells: {np.sum(valid_mask)}")

    # Precompute layer data (arrays) - avoid loading same layer multiple times
    layer_data_cache: Dict[str, np.ndarray] = {}

    def get_layer_array(layer_name: str) -> np.ndarray:
        """Get array for layer, with caching."""
        if layer_name in layer_data_cache:
            return layer_data_cache[layer_name]

        *group_parts, var = layer_name.split("/")
        group = "/".join(group_parts)

        if group not in dataset:
            raise ValueError(
                f"Group '{group}' not found in dataset for layer '{layer_name}'. "
                f"Available groups: {list(dataset.keys())}"
            )

        if var not in dataset[group]:
            raise ValueError(
                f"Variable '{var}' not found in group '{group}' for layer '{layer_name}'. "
                f"Available variables: {list(dataset[group].data_vars.keys())}"
            )

        data_var = dataset[group][var]
        if hasattr(data_var.data, "compute"):
            arr = data_var.data.compute()
        else:
            arr = data_var.values

        layer_data_cache[layer_name] = arr
        return arr

    # Build objective function
    objective_terms = []
    for layer_name, props in conditions.items():
        mode = props.mode
        importance = props.importance

        # Skip non-flexible layers or those with zero importance
        if mode != "flexible" or importance == 0 or importance is None:
            logger.info(
                f"Skipping '{layer_name}' for objective (mode={mode}, importance={importance})"
            )
            continue

        logger.info(f"Processing objective layer '{layer_name}'")

        # Get array (cached if already loaded)
        arr = get_layer_array(layer_name)

        logger.info(f"  Array shape: {arr.shape}, dtype: {arr.dtype}")
        logger.info(f"  Min/Max: {np.nanmin(arr):.3f} / {np.nanmax(arr):.3f}")
        logger.info(f"  Non-NaN values: {np.sum(~np.isnan(arr))}")

        # Build objective terms for all valid cells
        term_count = 0
        for r, c in cell_indices:
            val = arr[r, c]
            if not np.isnan(val):
                objective_terms.append(importance * val * decision_vars[(r, c)])
                term_count += 1

        logger.info(f"  Added {term_count} objective terms")

    logger.info(f"Total objective terms: {len(objective_terms)}")

    if objective_terms:
        prob += pulp.lpSum(objective_terms), "WeightedObjective"
        logger.info("Added weighted objective function")
    else:
        prob += pulp.lpSum(decision_vars.values()), "DummyObjective"
        logger.warning("No objective terms found, using dummy objective")

    # Track if explicit constraints were added
    has_explicit_constraints = False

    # Add constraints from all layers
    for layer_name, props in conditions.items():
        mode = props.mode
        constraints = props.constraints or []

        logger.info(f"Processing constraints for '{layer_name}' (mode={mode})")

        # Get array (cached if already loaded)
        arr = get_layer_array(layer_name)

        logger.info(f"  Array shape: {arr.shape}")
        logger.info(f"  Non-NaN values: {np.sum(~np.isnan(arr))}")
        logger.info(f"  Min/Max values: {np.nanmin(arr):.3f} / {np.nanmax(arr):.3f}")

        # Locked-in constraints
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
                for r, c in locked_cells:
                    prob += decision_vars[(r, c)] == 1
                has_explicit_constraints = True

            logger.info(f"  Locked in: {len(locked_cells)} variables")

        # Locked-out constraints
        elif mode == "locked-out":
            threshold = props.threshold
            if threshold is None:
                raise ValueError(
                    f"Threshold required for locked-out mode on layer '{layer_name}'"
                )

            locked_out_mask = valid_mask & (~np.isnan(arr)) & (arr > threshold)
            locked_rows, locked_cols = np.where(locked_out_mask)

            for r, c in zip(locked_rows, locked_cols, strict=False):
                if (r, c) in decision_vars:
                    prob += decision_vars[(r, c)] == 0
                    has_explicit_constraints = True

            logger.info(f"  Locked out: {len(locked_rows)} variables")
            logger.info(
                f"  Total cells > threshold: {np.sum((arr > threshold) & (~np.isnan(arr)))}"
            )

        # Value constraints
        for constr in constraints:
            min_val = constr.min
            max_val = constr.max
            typ = constr.type

            valid_cells = [(r, c) for r, c in cell_indices if not np.isnan(arr[r, c])]

            if not valid_cells:
                logger.warning(
                    f"  No valid values for constraint on layer '{layer_name}'"
                )
                continue

            constraint_terms = [
                arr[r, c] * decision_vars[(r, c)] for r, c in valid_cells
            ]
            total_sum = pulp.lpSum(constraint_terms)

            if typ == "percent":
                total_possible = sum(arr[r, c] for r, c in valid_cells)
                logger.info(
                    f"  Constraint (percent): total_possible = {total_possible:.3f}"
                )

                if total_possible == 0:
                    logger.warning(
                        f"  Total possible value is 0 for layer '{layer_name}'"
                    )
                    continue

                if min_val is not None:
                    prob += total_sum >= (min_val / 100) * total_possible
                    has_explicit_constraints = True
                    logger.info(
                        f"  Added: total_sum >= {(min_val / 100) * total_possible:.3f}"
                    )

                if max_val is not None:
                    prob += total_sum <= (max_val / 100) * total_possible
                    has_explicit_constraints = True
                    logger.info(
                        f"  Added: total_sum <= {(max_val / 100) * total_possible:.3f}"
                    )

            else:  # unit constraint
                total_possible = sum(arr[r, c] for r, c in valid_cells)
                logger.info(
                    f"  Constraint (unit): total_possible = {total_possible:.3f}"
                )

                if min_val is not None:
                    prob += total_sum >= min_val
                    has_explicit_constraints = True
                    logger.info(f"  Added: total_sum >= {min_val}")

                if max_val is not None:
                    prob += total_sum <= max_val
                    has_explicit_constraints = True
                    logger.info(f"  Added: total_sum <= {max_val}")

    # Add target area constraint if no explicit constraints
    if not has_explicit_constraints:
        if is_percentage:
            target_cells = int((target_area / 100) * len(cell_indices))
        else:
            target_cells = int(target_area)

        target_cells = max(1, min(target_cells, len(cell_indices)))

        prob += pulp.lpSum(decision_vars.values()) == target_cells
        logger.warning(
            f"No explicit constraints found. Using target area constraint: "
            f"select exactly {target_cells} cells ({100 * target_cells / len(cell_indices):.1f}% of {len(cell_indices)} valid cells)"
        )

    logger.info(
        f"Final model: {len(prob.variables())} variables, {len(prob.constraints)} constraints"
    )

    return prob, decision_vars


@task
def solve_lp(
    prob: pulp.LpProblem,
    cell_vars: Dict[Tuple[int, int], pulp.LpVariable],
) -> Tuple[str, Dict[Tuple[int, int], float]]:
    """
    Solve LP problem and extract solution values.

    Args:
        prob: The PuLP problem to solve
        cell_vars: Dictionary of decision variables

    Returns:
        Tuple of (solver_status, solution_values_dict)
    """
    logger = get_run_logger()

    num_vars = len(prob.variables())
    num_constraints = len(prob.constraints)
    logger.info(
        f"Solving LP with {num_vars} variables and {num_constraints} constraints"
    )

    # Solve the problem
    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    # Log solver status
    status = LpStatus[prob.status]
    logger.info(f"Solver status: {status}")

    obj_value = prob.objective.value()  # type: ignore
    logger.info(f"Objective value: {obj_value}")

    # Warn if not optimal
    if status not in ["Optimal"]:
        logger.warning(f"Solution is not optimal. Status: {status}")
        if status == "Infeasible":
            logger.error("Problem is infeasible - no valid solution exists")
        elif status == "Unbounded":
            logger.error("Problem is unbounded")

    # Count and log selected variables
    selected = sum(
        1 for v in prob.variables() if v.varValue is not None and v.varValue > 0
    )
    logger.info(f"Selected variables: {selected} / {num_vars}")

    # Log sample of variable values
    sample_vars = list(prob.variables())[:5]
    sample_values = [(v.name, v.varValue) for v in sample_vars]
    logger.info(f"Sample variable values: {sample_values}")

    # Extract solution values WHILE STILL IN THIS PROCESS
    # This is crucial - do it before the object is serialized
    solution_values: Dict[Tuple[int, int], float] = {}
    for (r, c), var in cell_vars.items():
        if var.varValue is not None:
            solution_values[(r, c)] = float(var.varValue)
        else:
            solution_values[(r, c)] = 0.0

    logger.info(f"Extracted {len(solution_values)} solution values")
    logger.info(f"Non-zero cells: {sum(1 for v in solution_values.values() if v > 0)}")

    return status, solution_values


def _process_cell_chunk(
    chunk: Dict[Tuple[int, int], pulp.LpVariable],
    nrows: int,
    ncols: int,
) -> np.ndarray:
    """
    Process a chunk of decision variables and return a partial solution array.
    This function is submitted to workers.
    """
    partial_array = np.zeros((nrows, ncols), dtype=float)
    selected = 0

    for (i, j), var in chunk.items():
        if var.varValue is not None and var.varValue > 0:
            partial_array[i, j] = 1.0
            selected += 1
        else:
            partial_array[i, j] = 0.0

    return partial_array


@task
def extract_solution(
    solution_values: Dict[Tuple[int, int], float],
    nrows: int,
    ncols: int,
    geometry: Sequence[BaseGeometry],
    transform,
) -> np.ndarray:
    """Extract solution from pre-computed values."""
    logger = get_run_logger()

    # Build solution array directly from values
    solution_array = np.zeros((nrows, ncols), dtype=float)
    for (i, j), value in solution_values.items():
        solution_array[i, j] = value

    logger.info(
        f"Solution array BEFORE masking: sum={np.sum(solution_array)}, non-zero={np.count_nonzero(solution_array)}"
    )

    # Apply geometry mask
    geometry_mask = rasterize(
        [(mapping(geom), 1) for geom in geometry],
        out_shape=(nrows, ncols),
        transform=transform,
        fill=0,
        dtype=np.uint8,
    )

    masked_solution = np.where(geometry_mask == 1, solution_array, 0)
    logger.info(
        f"Solution array AFTER masking: sum={np.sum(masked_solution)}, non-zero={np.count_nonzero(masked_solution)}"
    )

    return masked_solution


@task
def visualize(solution: np.ndarray):
    plt.figure(figsize=(12, 12))
    plt.title("Selected Conservation Areas")
    im = plt.imshow(solution, cmap="viridis")
    plt.colorbar(im)
    plt.tight_layout()
    plt.savefig(f"/data/outputs/{datetime.now().strftime('%Y%m%dT%H%M%S')}.png")
    plt.close()


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

    x_coords = np.linspace(bounds[0], bounds[2], width)
    y_coords = np.linspace(bounds[3], bounds[1], height)

    uint8_array = (array * 255).astype(np.uint8)
    da = xr.DataArray(
        uint8_array,
        dims=("y", "x"),
        coords={"x": x_coords, "y": y_coords},
        attrs={"_FillValue": 0},
    )
    da.rio.write_crs(crs, inplace=True)
    da.rio.write_transform(transform, inplace=True)

    da_web = da.rio.reproject("EPSG:3857", resampling=Resampling.bilinear)
    wm_bounds = tuple(map(float, da_web.rio.bounds()))
    logger.info(f"Reprojected bounds (EPSG:3857): {wm_bounds}")

    to_webmercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    to_latlon = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

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

                    tile_bounds_4326 = tms.bounds(tile)
                    left, bottom = to_webmercator.transform(
                        tile_bounds_4326.left, tile_bounds_4326.bottom
                    )
                    right, top = to_webmercator.transform(
                        tile_bounds_4326.right, tile_bounds_4326.top
                    )

                    if (
                        right < wm_bounds[0]
                        or left > wm_bounds[2]
                        or top < wm_bounds[1]
                        or bottom > wm_bounds[3]
                    ):
                        logger.warning(f"Skipping out-of-bounds tile: {tile}")
                        continue

                    tile_data = reader.tile(x, y, z, tilesize=tile_size)

                    if hasattr(tile_data.array, "mask") and tile_data.array.mask.all():
                        logger.warning(f"Skipping empty tile: {tile}")
                        continue

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
    """
    Calculate appropriate max zoom level based on input resolution.
    """
    res = np.clip(resolution, min_res, max_res)
    t = (np.log(res) - np.log(min_res)) / (np.log(max_res) - np.log(min_res))
    zoom = max_zoom - t * (max_zoom - min_zoom)
    return int(round(zoom))


@task
def prepare_dataset(
    zarr_path: str,
    layer_names: List[str],
    downsample_factor: int = 25,
    crs: int = 3005,
) -> Dict[str, xr.Dataset]:
    """
    Prepare dataset by loading and downsampling variables from zarr store.
    """
    group_map = defaultdict(list)
    for layer in layer_names:
        group, var = layer.split("/", 1)
        group_map[group].append(var)

    processed_groups = {}

    for group, variables in group_map.items():
        group_ds = xr.open_zarr(zarr_path, group=group, consolidated=True)

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
def execute_optimization(
    conditions: OptimizationParameters,
) -> Optional[np.ndarray]:
    """
    Main optimization task that runs on the Dask cluster.
    Returns the final solution array.
    """

    logger = get_run_logger()

    # Declare once with union type, then assign in branches
    british_columbia_geometry: Sequence[BaseGeometry]

    if conditions.geometry:
        geometry_list: Sequence[BaseGeometry] = conditions.geometry
        logger.info(f"Converting {len(geometry_list)} geometries to BC CRS (EPSG:3005)")

        # Convert to BC CRS and unify
        gdf = gpd.GeoDataFrame(geometry=geometry_list, crs="EPSG:4326").to_crs(
            "EPSG:3005"
        )
        unified_geom = gdf.geometry.unary_union  # Property, not method

        logger.info(f"Unified geometry type: {type(unified_geom).__name__}")

        # Ensure we always have a list of geometries
        if isinstance(
            unified_geom, (GeometryCollection, MultiPolygon, MultiLineString)
        ):
            british_columbia_geometry = list(unified_geom.geoms)
            logger.info(f"Split into {len(british_columbia_geometry)} geometries")
        else:
            british_columbia_geometry = [unified_geom]
            logger.info("Using single unified geometry")
    else:
        logger.info("No custom geometry provided, loading BC boundary")
        british_columbia_geometry = load_british_columbia_boundary(
            "/data/british_columbia.gdb"
        )
        logger.info(f"Loaded {len(british_columbia_geometry)} BC boundary geometries")

    layers = conditions.layers
    if not layers:
        raise ValueError("No layers provided in conditions.layers")

    # Load input data
    logger.info("Loading input data...")
    layer_paths = list(layers.keys())
    input_datasets: Dict[str, xr.Dataset] = load_input_data(
        os.getenv("ZARR_STORE_PATH"),
        layer_paths,
        resolution=conditions.resolution,
        resampling=conditions.resampling,
        geometry=british_columbia_geometry,
    )
    logger.info(f"Loaded {len(input_datasets)} dataset groups")

    # Pick a reference array
    reference_array_path = next(iter(layers))
    *group_parts, var = reference_array_path.split("/")
    group_path = "/".join(group_parts)
    reference_dataset: xr.Dataset = input_datasets[group_path]
    reference_array: xr.DataArray = reference_dataset[var]

    # Ensure CRS is set
    if reference_array.rio.crs is None:
        reference_array = reference_array.rio.write_crs("EPSG:3005")

    # Create boolean mask
    logger.info("Creating boolean mask...")
    valid_mask, nrows, ncols, transform = create_boolean_masks(
        reference_array=reference_array,
        bounds=british_columbia_geometry,
    )
    logger.info(
        f"Valid mask shape: {valid_mask.shape}, Valid cells: {np.sum(valid_mask)}"
    )

    # Build optimization model
    logger.info("Building optimization model...")
    pulp_model, cell_vars = build_pulp_model(
        dataset=input_datasets,
        conditions=layers,
        valid_mask=valid_mask,
        target_area=conditions.target_area,
        is_percentage=conditions.is_percentage,
    )
    logger.info(f"Built model with {len(cell_vars)} decision variables")

    # Solve LP
    logger.info("Solving LP...")
    status, solution_values = solve_lp(pulp_model, cell_vars)
    logger.info(f"Solver status: {status}")
    logger.info(f"Extracted {len(solution_values)} solution values")

    # Extract solution
    logger.info("Extracting solution...")
    solution_array: np.ndarray = extract_solution(
        solution_values=solution_values,
        nrows=nrows,
        ncols=ncols,
        geometry=british_columbia_geometry,
        transform=transform,
    )
    logger.info(f"Solution array sum: {np.sum(solution_array)}")

    if not np.any(solution_array > 0):
        logger.warning("No solution found")
        return None

    # Visualize
    logger.info("Creating visualization...")
    visualize(solution_array)

    # Create PMTiles
    logger.info("Creating PMTiles archive...")
    max_zoom = resolution_to_max_zoom(conditions.resolution)
    create_pmtiles_archive(
        array=solution_array,
        transform=transform,
        out_path="/data/outputs/solution.pmtiles",
        crs="EPSG:3005",
        max_zoom=max_zoom,
    )

    logger.info("Optimization completed successfully")
    return solution_array
