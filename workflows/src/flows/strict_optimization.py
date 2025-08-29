import os

import geopandas as gpd
import numpy as np
from prefect import (
    flow,
    get_run_logger,
)

from ..tasks.strict_optimization import (
    OptimizationParameters,
    build_pulp_model,
    create_boolean_masks,
    create_pmtiles_archive,
    extract_solution,
    load_british_columbia_boundary,
    load_input_data,
    resolution_to_max_zoom,
    solve_lp,
    visualize,
)


@flow(name="strict_optimization")
def strict_optimization(
    conditions: OptimizationParameters,
):
    logger = get_run_logger()

    # Load British Columbia boundary or the custom geometry
    if conditions.geometry:
        british_columbia_geometry = [
            gpd.GeoDataFrame(
                geometry=conditions.geometry,
                crs="EPSG:4326",  # GeoJSON is 4326
            )
            .to_crs("EPSG:3005")
            .union_all(method="coverage")
        ]
    else:
        british_columbia_geometry = load_british_columbia_boundary(
            "/data/british_columbia.gdb"
        )

    layers = conditions.layers or {}

    # Raise an error if no layers provided
    if not layers:
        raise ValueError(
            "No layers provided. 'conditions.layers'\
                  must contain at least one layer."
        )

    # Extract layer paths from conditions object keys
    layer_paths = list(layers.keys())

    # Load your input dataset (returns xarray.Dataset)
    input_dataset = load_input_data(
        os.getenv("ZARR_STORE_PATH"),
        layer_paths,
        resolution=conditions.resolution,
        resampling=conditions.resampling,
        geometry=british_columbia_geometry,
    )

    # Get the first array from the nested structure
    reference_array_path = next(iter(layers))
    (
        *group_parts,
        var,
    ) = reference_array_path.split("/")
    group_path = "/".join(group_parts)

    # Access the dataset and variable
    reference_array = input_dataset[group_path][var]

    # Create geometry-based mask and metadata
    (
        valid_mask,
        nrows,
        ncols,
        transform,
    ) = create_boolean_masks(
        reference_array=reference_array,
        bounds=british_columbia_geometry,
    )

    print(
        valid_mask,
        np.nanmax(valid_mask),
    )

    # Build and solve optimization model
    (
        pulp_model,
        cell_vars,
    ) = build_pulp_model(
        dataset=input_dataset,
        conditions=layers,
        valid_mask=valid_mask,
    )

    solve_lp(pulp_model)

    # Extract and visualize the solution
    solution_array = extract_solution(
        cell_vars=cell_vars,
        nrows=nrows,
        ncols=ncols,
        geometry=british_columbia_geometry,
        transform=transform,
    )

    # Validate that the solution isn't empty and return early if true
    if not np.any(solution_array > 0):
        logger.warning("No solution found")
        return

    visualize(solution_array)

    # Create pmtiles archive of the result
    transform = reference_array.rio.transform()
    max_zoom = resolution_to_max_zoom(conditions.resolution)
    create_pmtiles_archive(
        array=solution_array,
        transform=transform,
        out_path="/data/outputs/solution.pmtiles",
        crs="EPSG:3005",
        max_zoom=max_zoom,
    )
