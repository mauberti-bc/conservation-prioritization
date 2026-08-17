from __future__ import annotations

import gc
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

import numpy as np

from .highs import HighsModelSession, require_acceptable_result
from .model import CompiledOptimizationModel, SolveConfiguration, SolverResult
from .numerical import csr_row_activities


PRIORITY_BUDGET_FRACTIONS: tuple[float, ...] = (
    0.1,
    0.2,
    0.3,
    0.4,
    0.5,
    0.6,
    0.7,
    0.8,
    0.9,
    1.0,
)
PRIORITY_INTERMEDIATE_DTYPE = np.float32
PRIORITY_CHUNK_ELEMENTS = 1_048_576
PRIORITY_INTERMEDIATE_SCHEMA_VERSION = 1


@dataclass(frozen=True)
class PriorityRankingResult:
    """Complete priority-ranking score and per-increment LP diagnostics."""

    priority: np.ndarray
    priority_path: str
    increment_paths: tuple[str, ...]
    final_result: SolverResult
    diagnostics: tuple[dict[str, object], ...]
    budget_fractions: tuple[float, ...]
    allocation_total: float
    objective_value: float | None
    runtime_seconds: float


def solve_priority_ranking(
    model: CompiledOptimizationModel,
    *,
    configuration: SolveConfiguration,
    work_directory: str | Path,
    budget_fractions: Sequence[float] = PRIORITY_BUDGET_FRACTIONS,
    progress_callback: Callable[[dict[str, object]], None] | None = None,
) -> PriorityRankingResult:
    """Solve nested whole-AOI increments, persist them, and synthesize the mean."""
    _validate_priority_model(model)
    work_path = Path(work_directory)
    work_path.mkdir(parents=True, exist_ok=True)
    fractions = tuple(float(value) for value in budget_fractions)
    if not fractions:
        raise ValueError("Priority ranking requires at least one budget fraction.")
    if any(value <= 0 or value > 1 for value in fractions):
        raise ValueError("Priority budget fractions must be in the interval (0, 1].")
    if any(
        fractions[index] <= fractions[index - 1]
        for index in range(1, len(fractions))
    ):
        raise ValueError("Priority budget fractions must be strictly increasing.")

    primary_count = int(model.primary_variable_count)
    allocation_row = _priority_allocation_row(model)
    upper = np.asarray(model.variable_upper[:primary_count], dtype=np.float64)
    columns = np.arange(primary_count, dtype=np.int32)
    diagnostics: list[dict[str, object]] = []
    increment_paths: list[Path] = []
    final_result: SolverResult | None = None
    total_runtime = 0.0
    priority_sum_path = work_path / "priority-sum.npy"
    priority_sum = np.lib.format.open_memmap(
        priority_sum_path,
        mode="w+",
        dtype=PRIORITY_INTERMEDIATE_DTYPE,
        shape=(primary_count,),
    )
    priority_sum[:] = 0.0
    priority_sum.flush()
    _write_intermediate_manifest(
        work_path,
        primary_count=primary_count,
        budget_fractions=fractions,
        increment_paths=increment_paths,
        diagnostics=diagnostics,
        status="running",
    )

    for index, fraction in enumerate(fractions, start=1):
        target = fraction * primary_count
        lower = np.asarray(
            model.variable_lower[:primary_count],
            dtype=np.float64,
        ).copy()
        previous_allocation = _previous_allocation(
            increment_paths,
            lower.shape,
        )
        if previous_allocation is not None:
            np.maximum(lower, previous_allocation, out=lower)
        np.clip(lower, 0.0, 1.0, out=lower)
        np.minimum(lower, upper, out=lower)
        if float(np.sum(lower)) > target + 1e-6:
            raise RuntimeError(
                "Priority ranking became infeasible before solve: nested lower "
                f"bounds sum to {float(np.sum(lower)):.9f}, exceeding target "
                f"{target:.9f} at budget {fraction:.1%}."
            )
        with HighsModelSession(model, configuration=configuration) as session:
            session.change_row_bounds(allocation_row, target, target)
            session.change_column_bounds(columns, lower, upper)
            result = session.solve(
                progress_callback=_increment_progress_callback(
                    progress_callback,
                    index,
                    fraction,
                    target,
                )
            )
        total_runtime += result.runtime_seconds
        try:
            require_acceptable_result(result, configuration, model)
        except RuntimeError as error:
            raise RuntimeError(
                "Priority ranking solve failed at budget "
                f"{fraction:.1%}: {error}"
            ) from error
        allocation_path = work_path / f"allocation-{index:02d}.npy"
        allocation = _write_increment_allocation(
            allocation_path,
            result.native_columns[:primary_count],
        )
        achieved = float(np.sum(allocation, dtype=np.float64))
        if abs(achieved - target) > 1e-5:
            raise RuntimeError(
                "Priority ranking exact allocation target was not satisfied at "
                f"budget {fraction:.1%}: achieved {achieved:.9f}, target "
                f"{target:.9f}."
            )
        if previous_allocation is not None and np.any(
            allocation + 1e-6 < previous_allocation
        ):
            raise RuntimeError(
                "Priority ranking nesting was violated at budget "
                f"{fraction:.1%}."
            )
        row_activities = csr_row_activities(model, result.native_columns)
        diagnostics.append(
            {
                "increment": index,
                "budget_fraction": fraction,
                "allocation_target": target,
                "achieved_allocation": achieved,
                "allocation_row_activity": float(row_activities[allocation_row]),
                "objective_value": result.objective_value,
                "solver_status": result.status,
                "runtime_seconds": result.runtime_seconds,
                "termination_reason": result.termination_reason,
                "primal_feasibility": _diagnostic_value(
                    result,
                    "max_primal_infeasibility",
                ),
                "dual_feasibility": _diagnostic_value(
                    result,
                    "max_dual_infeasibility",
                ),
                "simplex_iterations": _diagnostic_value(
                    result,
                    "simplex_iterations",
                ),
                "ipm_iterations": _diagnostic_value(result, "ipm_iterations"),
                "allocation_path": str(allocation_path),
            }
        )
        _accumulate_priority_sum(priority_sum, allocation)
        if progress_callback is not None:
            progress_callback(
                {
                    "phase": "increment_complete",
                    "increment": index,
                    "budget_fraction": fraction,
                    "allocation_target": target,
                    "achieved_allocation": achieved,
                    "runtime_seconds": result.runtime_seconds,
                }
            )
        if increment_paths:
            increment_paths[-1].unlink(missing_ok=True)
        increment_paths.append(allocation_path)
        _write_intermediate_manifest(
            work_path,
            primary_count=primary_count,
            budget_fractions=fractions,
            increment_paths=increment_paths,
            diagnostics=diagnostics,
            status="running",
        )
        if index < len(fractions):
            final_result = None
            del result
            del allocation
            gc.collect()
        else:
            final_result = result

    if final_result is None:
        raise RuntimeError("Priority ranking did not execute any budget increments.")
    priority_path = work_path / "priority-mean.npy"
    priority, allocation_total = synthesize_priority_from_sum(
        priority_sum_path,
        priority_path,
        primary_count,
        len(fractions),
    )
    del priority_sum
    retained_increment_paths = [
        path for path in increment_paths if path.exists()
    ]
    _write_intermediate_manifest(
        work_path,
        primary_count=primary_count,
        budget_fractions=fractions,
        increment_paths=retained_increment_paths,
        diagnostics=diagnostics,
        status="complete",
        priority_path=priority_path,
        priority_total=allocation_total,
    )
    return PriorityRankingResult(
        priority=priority,
        priority_path=str(priority_path),
        increment_paths=tuple(str(path) for path in retained_increment_paths),
        final_result=final_result,
        diagnostics=tuple(diagnostics),
        budget_fractions=fractions,
        allocation_total=allocation_total,
        objective_value=final_result.objective_value,
        runtime_seconds=total_runtime,
    )


def _accumulate_priority_sum(
    priority_sum: np.memmap,
    allocation: np.ndarray,
) -> None:
    """Add one allocation vector to the file-backed priority running sum."""
    primary_count = int(priority_sum.shape[0])
    for start in range(0, primary_count, PRIORITY_CHUNK_ELEMENTS):
        stop = min(start + PRIORITY_CHUNK_ELEMENTS, primary_count)
        chunk = np.asarray(priority_sum[start:stop], dtype=np.float32)
        chunk += np.asarray(allocation[start:stop], dtype=np.float32)
        priority_sum[start:stop] = chunk
    priority_sum.flush()


def synthesize_priority_from_increments(
    increment_paths: Sequence[str | Path],
    output_path: str | Path,
    primary_count: int,
    *,
    chunk_size: int = PRIORITY_CHUNK_ELEMENTS,
) -> tuple[np.ndarray, float]:
    """Build the final priority mean from persisted increment allocations."""
    if not increment_paths:
        raise ValueError("Priority synthesis requires at least one increment.")
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = _temporary_path(destination)
    priority_writer = np.lib.format.open_memmap(
        temporary,
        mode="w+",
        dtype=PRIORITY_INTERMEDIATE_DTYPE,
        shape=(primary_count,),
    )
    sources = [
        np.load(Path(path), mmap_mode="r", allow_pickle=False)
        for path in increment_paths
    ]
    for source in sources:
        if source.shape != (primary_count,):
            raise ValueError("Priority increment shape does not match domain size.")
    allocation_total = 0.0
    for start in range(0, primary_count, chunk_size):
        stop = min(start + chunk_size, primary_count)
        total = np.zeros(stop - start, dtype=np.float64)
        for source in sources:
            total += np.asarray(source[start:stop], dtype=np.float64)
        chunk = total / len(sources)
        priority_writer[start:stop] = chunk.astype(
            PRIORITY_INTERMEDIATE_DTYPE,
            copy=False,
        )
        allocation_total += float(np.sum(chunk))
    priority_writer.flush()
    del priority_writer
    os.replace(temporary, destination)
    priority = np.load(destination, mmap_mode="r", allow_pickle=False)
    return priority, allocation_total


def synthesize_priority_from_sum(
    priority_sum_path: str | Path,
    output_path: str | Path,
    primary_count: int,
    increment_count: int,
    *,
    chunk_size: int = PRIORITY_CHUNK_ELEMENTS,
) -> tuple[np.ndarray, float]:
    """Build the final priority mean from one persisted running-sum vector."""
    if increment_count <= 0:
        raise ValueError("Priority synthesis requires at least one increment.")
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = _temporary_path(destination)
    source = np.load(Path(priority_sum_path), mmap_mode="r", allow_pickle=False)
    if source.shape != (primary_count,):
        raise ValueError("Priority sum shape does not match domain size.")
    priority_writer = np.lib.format.open_memmap(
        temporary,
        mode="w+",
        dtype=PRIORITY_INTERMEDIATE_DTYPE,
        shape=(primary_count,),
    )
    allocation_total = 0.0
    for start in range(0, primary_count, chunk_size):
        stop = min(start + chunk_size, primary_count)
        chunk = np.asarray(source[start:stop], dtype=np.float32) / float(
            increment_count
        )
        priority_writer[start:stop] = chunk
        allocation_total += float(np.sum(chunk, dtype=np.float64))
    priority_writer.flush()
    del priority_writer
    os.replace(temporary, destination)
    priority = np.load(destination, mmap_mode="r", allow_pickle=False)
    return priority, allocation_total


def _previous_allocation(
    increment_paths: Sequence[Path],
    expected_shape: tuple[int, ...],
) -> np.ndarray | None:
    """Memory-map the previous increment allocation when one exists."""
    if not increment_paths:
        return None
    previous = np.load(increment_paths[-1], mmap_mode="r", allow_pickle=False)
    if previous.shape != expected_shape:
        raise ValueError("Previous priority allocation shape is invalid.")
    return previous


def _write_increment_allocation(
    output_path: Path,
    values: np.ndarray,
    *,
    chunk_size: int = PRIORITY_CHUNK_ELEMENTS,
) -> np.ndarray:
    """Persist one clipped increment allocation and return it memory-mapped."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = _temporary_path(output_path)
    allocation = np.lib.format.open_memmap(
        temporary,
        mode="w+",
        dtype=PRIORITY_INTERMEDIATE_DTYPE,
        shape=(len(values),),
    )
    for start in range(0, len(values), chunk_size):
        stop = min(start + chunk_size, len(values))
        allocation[start:stop] = np.clip(
            np.asarray(values[start:stop], dtype=np.float64),
            0.0,
            1.0,
        ).astype(PRIORITY_INTERMEDIATE_DTYPE, copy=False)
    allocation.flush()
    del allocation
    os.replace(temporary, output_path)
    return np.load(output_path, mmap_mode="r", allow_pickle=False)


def _write_intermediate_manifest(
    work_path: Path,
    *,
    primary_count: int,
    budget_fractions: Sequence[float],
    increment_paths: Sequence[Path],
    diagnostics: Sequence[dict[str, object]],
    status: str,
    priority_path: Path | None = None,
    priority_total: float | None = None,
) -> None:
    """Atomically record the disk-backed priority intermediate store."""
    manifest_path = work_path / "manifest.json"
    temporary = _temporary_path(manifest_path)
    payload = {
        "schema_version": PRIORITY_INTERMEDIATE_SCHEMA_VERSION,
        "format": "npy-memmap",
        "dtype": np.dtype(PRIORITY_INTERMEDIATE_DTYPE).str,
        "primary_count": primary_count,
        "budget_fractions": list(budget_fractions),
        "increment_count": len(increment_paths),
        "increments": [
            {
                "path": str(path),
                "budget_fraction": float(budget_fractions[index]),
            }
            for index, path in enumerate(increment_paths)
        ],
        "priority_path": str(priority_path) if priority_path is not None else None,
        "priority_total": priority_total,
        "diagnostics": list(diagnostics),
        "status": status,
    }
    temporary.write_text(
        json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    os.replace(temporary, manifest_path)


def _temporary_path(path: Path) -> Path:
    """Return a sibling path suitable for atomic replacement."""
    return path.with_name(f".{path.name}.tmp")


def _validate_priority_model(model: CompiledOptimizationModel) -> None:
    """Reject compiled models that cannot support exact whole-AOI ranking."""
    if model.primary_variable_count <= 0:
        raise ValueError("Priority ranking requires at least one planning unit.")
    primary_integrality = np.asarray(model.integrality[: model.primary_variable_count])
    if np.any(primary_integrality != 0):
        raise ValueError("Priority ranking requires continuous primary variables.")
    if _priority_allocation_row(model) < 0:
        raise ValueError("Priority ranking requires a priority_allocation_target row.")


def _priority_allocation_row(model: CompiledOptimizationModel) -> int:
    """Return the reserved exact-allocation row index."""
    for row_index, row_name in enumerate(model.row_names):
        if row_name == "priority_allocation_target":
            return row_index
    return -1


def _diagnostic_value(result: SolverResult, name: str) -> object:
    """Read one portable HiGHS diagnostic when available."""
    diagnostics = result.diagnostics or {}
    value = diagnostics.get(name)
    if isinstance(value, (float, int, str)) or value is None:
        return value
    return None


def _increment_progress_callback(
    progress_callback: Callable[[dict[str, object]], None] | None,
    increment: int,
    budget_fraction: float,
    allocation_target: float,
) -> Callable[[dict[str, object]], None] | None:
    """Attach priority-increment context to solver heartbeat progress."""
    if progress_callback is None:
        return None

    def report(progress: dict[str, object]) -> None:
        progress_callback(
            {
                **progress,
                "increment": increment,
                "budget_fraction": budget_fraction,
                "allocation_target": allocation_target,
            }
        )

    return report
