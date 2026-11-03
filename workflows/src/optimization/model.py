from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator, Literal, Mapping, Sequence, overload

import numpy as np

from .neighbor import NeighborPenaltySpecification, NeighborStructure
from .reduction import ReductionStatistics


@dataclass(frozen=True)
class NeighborCompilationMetadata:
    """Auditable neighbor simplification and objective decomposition metadata."""

    specification: NeighborPenaltySpecification
    structure: NeighborStructure
    raw_neighbor_edge_count: int
    constant_neighbor_edge_count: int
    constant_selected_neighbor_edge_count: int
    unary_neighbor_edge_count: int
    fixed0_unary_neighbor_edge_count: int
    fixed1_unary_neighbor_edge_count: int
    pairwise_neighbor_edge_count: int
    normalization_method: str
    normalization_method_version: int
    normalization_scale: float
    resolved_coefficient: float
    status: Literal["active", "degenerate"]


class CompactRowNames(Sequence[str]):
    """Expose row roles as a sequence backed by contiguous range metadata."""

    def __init__(self, blocks: Sequence[tuple[str, int, int]], row_count: int):
        self.blocks = tuple(blocks)
        self._row_count = row_count

    @classmethod
    def from_names(cls, names: Sequence[str]) -> CompactRowNames:
        """Compress a small ordered name sequence into contiguous blocks."""
        if not names:
            return cls((), 0)
        blocks: list[tuple[str, int, int]] = []
        start = 0
        current = names[0]
        for index, name in enumerate(names[1:], start=1):
            if name == current:
                continue
            blocks.append((current, start, index))
            current = name
            start = index
        blocks.append((current, start, len(names)))
        return cls(blocks, len(names))

    def __len__(self) -> int:
        return self._row_count

    @overload
    def __getitem__(self, index: int) -> str: ...

    @overload
    def __getitem__(self, index: slice) -> Sequence[str]: ...

    def __getitem__(self, index: int | slice) -> str | Sequence[str]:
        if isinstance(index, slice):
            return tuple(self[value] for value in range(*index.indices(len(self))))
        resolved = index + len(self) if index < 0 else index
        if resolved < 0 or resolved >= len(self):
            raise IndexError(index)
        for name, start, stop in self.blocks:
            if start <= resolved < stop:
                return name
        raise IndexError(index)

    def __iter__(self) -> Iterator[str]:
        for name, start, stop in self.blocks:
            yield from (name for _ in range(start, stop))


@dataclass(frozen=True)
class CompiledOptimizationModel:
    """Narrow solver-neutral numerical model stored as a row-wise CSR matrix."""

    objective: np.ndarray
    variable_lower: np.ndarray
    variable_upper: np.ndarray
    integrality: np.ndarray
    row_starts: np.ndarray
    column_indices: np.ndarray
    coefficients: np.ndarray
    row_lower: np.ndarray
    row_upper: np.ndarray
    row_names: Sequence[str]
    primary_variable_count: int
    maximize: bool = True
    objective_offset: float = 0.0

    @property
    def variable_count(self) -> int:
        """Return the number of optimization variables."""
        return len(self.objective)

    @property
    def constraint_count(self) -> int:
        """Return the number of linear constraint rows."""
        return len(self.row_lower)

    @property
    def nonzero_count(self) -> int:
        """Return the number of constraint-matrix coefficients."""
        return len(self.coefficients)


@dataclass(frozen=True)
class CanonicalObjectiveValues:
    """Retain one objective layer's sparse canonical planning-unit values."""

    layer: str
    indices: np.ndarray
    values: np.ndarray


@dataclass(frozen=True)
class CompilationReconstruction:
    """Domain-to-column mapping used only for validation and reconstruction."""

    planning_units: np.ndarray | None
    planning_unit_solver_columns: np.ndarray
    planning_unit_fixed_values: np.ndarray
    compiled_primary_objective: np.ndarray
    canonical_objectives: tuple[CanonicalObjectiveValues, ...]
    neighbor: NeighborCompilationMetadata | None
    reduction: ReductionStatistics

    @property
    def planning_unit_count(self) -> int:
        """Return the number of spatial planning units, excluding auxiliaries."""
        if self.planning_units is not None:
            return len(self.planning_units)
        return len(self.planning_unit_solver_columns)

@dataclass(frozen=True)
class CompilationOutput:
    """Separate the numerical solver contract from reconstruction metadata."""

    model: CompiledOptimizationModel
    reconstruction: CompilationReconstruction

@dataclass(frozen=True)
class SolverResult:
    """Portable result returned by a solver adapter."""

    status: str
    objective_value: float | None
    optimality_gap: float | None
    runtime_seconds: float
    solver_name: str
    solver_version: str
    decisions: np.ndarray
    termination_reason: str | None = None
    best_bound: float | None = None
    absolute_gap: float | None = None
    node_count: int | None = None
    model_load_seconds: float | None = None
    presolve_seconds: float | None = None
    solve_seconds: float | None = None
    solver_settings: Mapping[str, object] | None = None
    native_columns: np.ndarray | None = None
    raw_conservation_benefit: float | None = None
    raw_neighbor_value: float | None = None
    neighbor_penalty_contribution: float | None = None
    memory_profile: dict[str, dict[str, int]] | None = None
    diagnostics: dict[str, object] | None = None


@dataclass(frozen=True)
class SolveConfiguration:
    """Authoritative solver policy that does not alter compiled-model identity.

    ``standard`` accepts a certified feasible incumbent when HiGHS reaches the
    configured limit. ``exact_audit`` requires a proven optimum and therefore
    always requests zero relative and absolute MIP gaps.
    """

    time_limit_seconds: float | None = None
    relative_mip_gap: float = 0.0
    absolute_mip_gap: float | None = None
    thread_count: int | None = None
    random_seed: int = 0
    output_flag: bool = False
    mode: Literal["standard", "exact_audit"] = "standard"
    options: Mapping[str, int | float | str | bool] | None = None

    def __post_init__(self) -> None:
        """Reject ambiguous or invalid solver resource settings."""
        if self.time_limit_seconds is not None and self.time_limit_seconds <= 0:
            raise ValueError("Solve time limit must be positive.")
        if self.relative_mip_gap < 0:
            raise ValueError("Relative MIP gap cannot be negative.")
        if self.absolute_mip_gap is not None and self.absolute_mip_gap < 0:
            raise ValueError("Absolute MIP gap cannot be negative.")
        if self.thread_count is not None and self.thread_count <= 0:
            raise ValueError("Solver thread count must be positive.")
        reserved_options = {
            "time_limit",
            "mip_rel_gap",
            "mip_abs_gap",
            "threads",
            "random_seed",
            "output_flag",
        }
        conflicts = reserved_options.intersection(self.options or {})
        if conflicts:
            raise ValueError(
                "Solve options cannot override authoritative settings: "
                + ", ".join(sorted(conflicts))
            )

    @property
    def effective_relative_mip_gap(self) -> float:
        """Return the gap passed to HiGHS for the selected solve mode."""
        return 0.0 if self.mode == "exact_audit" else self.relative_mip_gap

    @property
    def effective_absolute_mip_gap(self) -> float | None:
        """Return the absolute gap passed to HiGHS for the selected solve mode."""
        return 0.0 if self.mode == "exact_audit" else self.absolute_mip_gap


@dataclass(frozen=True)
class RowBoundOverride:
    """Override one compiled row bound for a solve scenario."""

    row_index: int
    lower: float
    upper: float


@dataclass(frozen=True)
class ColumnBoundOverride:
    """Override one compiled column bound for a solve scenario."""

    column_index: int
    lower: float
    upper: float


@dataclass(frozen=True)
class SolveScenario:
    """Contain solve-specific RHS and bound changes outside model identity."""

    scenario_id: str
    row_bounds: tuple[RowBoundOverride, ...] = ()
    column_bounds: tuple[ColumnBoundOverride, ...] = ()


@dataclass(frozen=True)
class WarmStart:
    """Reference one solve-specific incumbent outside the compiled model."""

    mathematical_model_hash: str
    artifact_uri: str
    artifact_content_hash: str
    candidate_ordering_hash: str


@dataclass(frozen=True)
class SolveRequest:
    """Bind an immutable compiled model to one solve-specific configuration."""

    compiled_model_uri: str
    mathematical_model_hash: str
    artifact_content_hash: str
    configuration: SolveConfiguration
    scenario: SolveScenario | None = None
    warm_start: WarmStart | None = None
