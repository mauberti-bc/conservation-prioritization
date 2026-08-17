"""Contract-driven raster aggregation and resampling policies."""

from __future__ import annotations

from typing import Any, Mapping

import numpy as np
from rasterio.enums import Resampling
from scipy import stats


SUPPORTED_AGGREGATIONS = frozenset(
    {
        "sum",
        "area_weighted_mean",
        "median",
        "maximum",
        "minimum",
        "any",
        "fraction",
        "mode",
    }
)

_AGGREGATIONS_BY_DATA_KIND = {
    "amount": frozenset(
        {"sum", "area_weighted_mean", "median", "maximum", "minimum"}
    ),
    "density": frozenset(
        {"area_weighted_mean", "median", "maximum", "minimum"}
    ),
    "probability": frozenset(
        {"area_weighted_mean", "median", "maximum", "minimum"}
    ),
    "binary": frozenset({"any", "fraction", "mode", "maximum", "minimum"}),
    "categorical": frozenset({"mode"}),
    "cost": frozenset(
        {"sum", "area_weighted_mean", "median", "maximum", "minimum"}
    ),
}


def validate_resampling_contract(
    contract: Mapping[str, Any], layer_id: str
) -> None:
    """Validate that a layer's aggregation preserves its declared data semantics."""
    data_kind = str(contract.get("data_kind", ""))
    aggregation = str(contract.get("aggregation_method", ""))
    allowed = _AGGREGATIONS_BY_DATA_KIND.get(data_kind)
    if allowed is None:
        raise ValueError(f"Layer {layer_id} has unsupported data kind: {data_kind}.")
    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(
            f"Layer {layer_id} has unsupported aggregation method: {aggregation}."
        )
    if aggregation not in allowed:
        raise ValueError(
            f"Layer {layer_id} cannot use {aggregation} aggregation for "
            f"{data_kind} data. Supported methods: {', '.join(sorted(allowed))}."
        )
    quantity_kind = str(contract.get("extensive_or_intensive", ""))
    if quantity_kind not in {"extensive", "intensive", "categorical"}:
        raise ValueError(
            f"Layer {layer_id} has unsupported quantity semantics: {quantity_kind}."
        )
    if aggregation == "mode" and quantity_kind != "categorical":
        raise ValueError(
            f"Layer {layer_id} must declare categorical quantity semantics "
            "when using mode aggregation."
        )
    if aggregation == "sum" and quantity_kind != "extensive":
        raise ValueError(
            f"Layer {layer_id} must declare extensive quantity semantics "
            "when using sum aggregation."
        )
    parameters = contract.get("aggregation_parameters")
    if aggregation == "mode" and (
        not isinstance(parameters, Mapping)
        or parameters.get("tie_rule") != "lowest_value"
    ):
        raise ValueError(
            f"Layer {layer_id} must declare the deterministic mode tie rule "
            "'lowest_value'."
        )


def rasterio_resampling(
    mapping_method: str, contract: Mapping[str, Any]
) -> Resampling:
    """Choose a warp kernel from mapping direction and layer semantics."""
    if mapping_method == "coarse_to_fine_nearest_constant":
        return Resampling.nearest
    if mapping_method == "coarse_to_fine_overlap_constant":
        if str(contract.get("aggregation_method")) == "mode":
            return Resampling.mode
        return Resampling.average

    aggregation = str(contract.get("aggregation_method", ""))
    kernels = {
        "sum": Resampling.sum,
        "area_weighted_mean": Resampling.average,
        "median": Resampling.med,
        "maximum": Resampling.max,
        "minimum": Resampling.min,
        "any": Resampling.max,
        "fraction": Resampling.average,
        "mode": Resampling.mode,
    }
    try:
        return kernels[aggregation]
    except KeyError as error:
        raise ValueError(
            f"Unsupported mapping aggregation method: {aggregation}."
        ) from error


def aggregate_nested_values(
    values: np.ndarray,
    destination_shape: tuple[int, int],
    factor: int,
    method: str,
) -> np.ndarray:
    """Aggregate an aligned fine grid using the layer's declared statistic."""
    blocks = values.reshape(
        destination_shape[0],
        factor,
        destination_shape[1],
        factor,
    ).transpose(0, 2, 1, 3)
    flattened = blocks.reshape(destination_shape[0], destination_shape[1], -1)
    valid = np.any(np.isfinite(flattened), axis=2)
    with np.errstate(all="ignore"):
        if method == "sum":
            result = np.nansum(flattened, axis=2)
        elif method in {"area_weighted_mean", "fraction"}:
            result = np.nanmean(flattened, axis=2)
        elif method == "median":
            result = np.nanmedian(flattened, axis=2)
        elif method in {"maximum", "any"}:
            result = np.nanmax(flattened, axis=2)
        elif method == "minimum":
            result = np.nanmin(flattened, axis=2)
        elif method == "mode":
            result = _mode_lowest_tie(flattened)
        else:
            raise ValueError(f"Unsupported mapping aggregation method: {method}.")
    result = np.asarray(result, dtype=np.float32)
    result[~valid] = np.nan
    return result


def aggregate_xarray_coarsen(coarsened: Any, method: str) -> Any:
    """Reduce an xarray coarsen window using a declared aggregation method."""
    if method == "sum":
        return coarsened.sum(skipna=True)
    if method in {"area_weighted_mean", "fraction"}:
        return coarsened.mean(skipna=True)
    if method == "median":
        return coarsened.reduce(np.nanmedian)
    if method == "minimum":
        return coarsened.reduce(np.nanmin)
    if method in {"maximum", "any"}:
        return coarsened.reduce(np.nanmax)
    if method == "mode":
        return coarsened.reduce(_nanmode)
    raise ValueError(f"Unsupported mapping aggregation method: {method}.")


def _nanmode(data: np.ndarray, axis: int) -> np.ndarray:
    mode_result = stats.mode(data, axis=axis, nan_policy="omit", keepdims=False)
    return np.asarray(mode_result.mode)


def _mode_lowest_tie(values: np.ndarray) -> np.ndarray:
    sorted_values = np.sort(values, axis=2)
    finite = np.isfinite(sorted_values)
    run_starts = np.ones(sorted_values.shape, dtype=bool)
    run_starts[:, :, 1:] = (
        sorted_values[:, :, 1:] != sorted_values[:, :, :-1]
    )
    indices = np.arange(sorted_values.shape[2], dtype=np.int32)
    start_indices = np.where(run_starts, indices, 0)
    starts = np.maximum.accumulate(start_indices, axis=2)
    run_lengths = indices - starts + 1
    run_ends = np.ones(sorted_values.shape, dtype=bool)
    run_ends[:, :, :-1] = run_starts[:, :, 1:]
    run_lengths[~run_ends | ~finite] = 0
    winners = np.argmax(run_lengths, axis=2)
    result = np.take_along_axis(sorted_values, winners[:, :, None], axis=2)[:, :, 0]
    result[~np.any(finite, axis=2)] = np.nan
    return result.astype(np.float32, copy=False)
