from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal


@dataclass(frozen=True)
class SparseModelDimensions:
    """Exact structural dimensions of the solver model to be compiled."""

    planning_units: int
    primary_variables: int
    auxiliary_variables: int
    constraint_rows: int
    matrix_nonzeros: int
    feature_nonzeros: int
    neighbor_edges: int

    @property
    def variable_count(self) -> int:
        """Return primary and formulation-introduced variables."""
        return self.primary_variables + self.auxiliary_variables


@dataclass(frozen=True)
class SparseExecutionProfile:
    """Operational capacity of one sparse compiler/solver deployment."""

    name: str
    max_peak_memory_bytes: int
    max_scratch_bytes: int
    safety_factor: float = 1.5

    def __post_init__(self) -> None:
        """Reject invalid deployment capacities before making an admission decision."""
        if not self.name:
            raise ValueError("Sparse execution profile name cannot be empty.")
        if self.max_peak_memory_bytes <= 0 or self.max_scratch_bytes <= 0:
            raise ValueError(
                "Sparse execution profile byte capacities must be positive."
            )
        if self.safety_factor < 1:
            raise ValueError(
                "Sparse execution profile safety factor must be at least one."
            )


@dataclass(frozen=True)
class ModelFootprint:
    """Estimated storage and peak-memory requirements for a sparse model."""

    compiler_array_bytes: int
    solver_model_bytes: int
    scratch_bytes: int
    estimated_peak_bytes: int


@dataclass(frozen=True)
class AdmissionOutcome:
    """Structured, independently auditable resource-admission decision."""

    admitted: bool
    gate: Literal["structural_inventory", "compiled_model"]
    reason_code: str
    measured: dict[str, int]
    footprint: dict[str, int]
    profile: dict[str, int | float | str]
    suggested_resolutions: tuple[int, ...] = ()


def estimate_sparse_model_footprint(
    dimensions: SparseModelDimensions,
    safety_factor: float,
) -> ModelFootprint:
    """Estimate concrete compiler, native-solver, and disk-scratch footprints.

    The estimate follows the current dtype layout: two int32 spatial coordinates,
    float64 objective/bounds, uint8 integrality, int64 row pointers, int32 column
    indices, and float64 coefficients. Native HiGHS storage and load-time buffers
    are budgeted separately so a profile is not admitted on file size alone.
    """
    values = asdict(dimensions)
    if min(values.values()) < 0:
        raise ValueError("Sparse model dimensions cannot be negative.")
    if dimensions.primary_variables > dimensions.planning_units:
        raise ValueError("Primary variables cannot exceed eligible planning units.")

    variables = dimensions.variable_count
    rows = dimensions.constraint_rows
    nonzeros = dimensions.matrix_nonzeros

    variable_array_bytes = variables * (8 + 8 + 8 + 1)
    matrix_array_bytes = (rows + 1) * 8 + nonzeros * (4 + 8) + rows * 2 * 8
    compiler_array_bytes = (
        variable_array_bytes + matrix_array_bytes
    )

    # HiGHS owns a native copy and returns a float64 primal vector. The int32
    # allowance covers native column metadata; Python load indices stay batched.
    solver_model_bytes = (
        variables * (8 + 8 + 8 + 1 + 8 + 4)
        + (rows + 1) * 8
        + nonzeros * (4 + 8)
        + rows * 2 * 8
    )

    # Preparation keeps spatial identity, packed masks, and feature/cost vectors
    # file-backed. Neighbor edges are regenerated late and are not stored O(E).
    preparation_bytes = (
        dimensions.feature_nonzeros * (4 + 8)
    )
    scratch_bytes = preparation_bytes + compiler_array_bytes
    estimated_peak_bytes = int(
        (compiler_array_bytes + solver_model_bytes) * safety_factor
    )
    return ModelFootprint(
        compiler_array_bytes=compiler_array_bytes,
        solver_model_bytes=solver_model_bytes,
        scratch_bytes=scratch_bytes,
        estimated_peak_bytes=estimated_peak_bytes,
    )


def admit_structural_inventory(
    planning_units: int,
    profile: SparseExecutionProfile,
) -> AdmissionOutcome:
    """Record planning-unit scale without treating it as an admission ceiling."""
    if planning_units < 0:
        raise ValueError("Planning-unit count cannot be negative.")
    return AdmissionOutcome(
        admitted=True,
        gate="structural_inventory",
        reason_code="structural_inventory_required",
        measured={"planning_units": planning_units},
        footprint={},
        profile=asdict(profile),
    )


def admit_sparse_model(
    dimensions: SparseModelDimensions,
    profile: SparseExecutionProfile,
) -> AdmissionOutcome:
    """Admit an exact model when its measured footprint fits the profile."""
    footprint = estimate_sparse_model_footprint(dimensions, profile.safety_factor)
    if footprint.estimated_peak_bytes > profile.max_peak_memory_bytes:
        reason_code = "profile_peak_memory_exceeded"
    elif footprint.scratch_bytes > profile.max_scratch_bytes:
        reason_code = "profile_scratch_space_exceeded"
    else:
        reason_code = "admitted"
    measured = asdict(dimensions)
    measured["variable_count"] = dimensions.variable_count
    return AdmissionOutcome(
        admitted=reason_code == "admitted",
        gate="compiled_model",
        reason_code=reason_code,
        measured=measured,
        footprint=asdict(footprint),
        profile=asdict(profile),
    )
