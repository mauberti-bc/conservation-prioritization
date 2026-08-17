from __future__ import annotations

import base64
import hashlib
from collections.abc import Iterator, Sequence
from dataclasses import asdict, dataclass

import numpy as np


NEIGHBOR_METHOD = "selected_rook_pairs"
NEIGHBOR_METHOD_VERSION = 1
PACKED_MASK_BIT_ORDER = "little"


@dataclass(frozen=True)
class NeighborPenaltySpecification:
    """Normalized selected-neighbor preference for one immutable run."""

    strength: float
    method: str = NEIGHBOR_METHOD
    method_version: int = NEIGHBOR_METHOD_VERSION

    def __post_init__(self) -> None:
        """Reject unsupported or non-positive neighbor specifications."""
        if self.method != NEIGHBOR_METHOD or self.method_version != 1:
            raise ValueError("Unsupported neighbor-penalty method or version.")
        if not np.isfinite(self.strength) or self.strength <= 0:
            raise ValueError("Neighbor-penalty strength must be finite and positive.")


@dataclass(frozen=True)
class NeighborObjectiveNormalization:
    """Record how selected rook-neighbor pairs become a soft objective term."""

    normalization_method: str
    normalization_method_version: int
    normalization_scale: float
    strength: float
    resolved_coefficient: float
    status: str

    def to_dict(self) -> dict[str, object]:
        """Return deterministic JSON-compatible compilation provenance."""
        return asdict(self)


def resolve_neighbor_normalization(
    specification: NeighborPenaltySpecification,
    attainable_edge_count: int,
) -> NeighborObjectiveNormalization:
    """Normalize selected pairs by their deterministic attainable edge count."""
    if attainable_edge_count < 0:
        raise ValueError("Attainable neighbor-edge count cannot be negative.")
    scale = float(attainable_edge_count)
    active = attainable_edge_count > 0
    return NeighborObjectiveNormalization(
        normalization_method="attainable_selected_rook_edge_count",
        normalization_method_version=1,
        normalization_scale=scale,
        strength=specification.strength,
        resolved_coefficient=(
            specification.strength / scale if active else 0.0
        ),
        status="active" if active else "degenerate",
    )


@dataclass(frozen=True)
class NeighborStructure:
    """Compact deterministic tiled representation of planning-unit topology."""

    height: int
    width: int
    tile_size: int
    planning_unit_count: int
    tiles: tuple[dict[str, object], ...]
    method: str = NEIGHBOR_METHOD
    method_version: int = NEIGHBOR_METHOD_VERSION


@dataclass(frozen=True)
class NeighborEdgeBlock:
    """One bounded typed block of canonical undirected rook edges."""

    first: np.ndarray
    second: np.ndarray
    first_state: np.ndarray
    second_state: np.ndarray

    @property
    def count(self) -> int:
        """Return the number of edges in this numeric block."""
        return len(self.first)


@dataclass(frozen=True)
class NeighborStructureCounts:
    """Exact edge categories implied by packed eligibility and fixed-state masks."""

    raw: int
    constant: int
    constant_selected: int
    unary: int
    fixed0_unary: int
    fixed1_unary: int
    pairwise: int


def encode_packed_mask(mask: np.ndarray) -> str:
    """Encode one boolean tile mask using the versioned row-major bit contract."""
    return base64.b64encode(packed_mask_bytes(mask)).decode("ascii")


def packed_mask_bytes(mask: np.ndarray) -> bytes:
    """Return canonical row-major packed bytes for one planning-grid mask."""
    values = np.asarray(mask, dtype=bool)
    return np.packbits(
        values.reshape(-1), bitorder=PACKED_MASK_BIT_ORDER
    ).tobytes()


def packed_mask_checksum(mask: np.ndarray) -> str:
    """Return the checksum of the exact bytes persisted by mask encoding."""
    return hashlib.sha256(packed_mask_bytes(mask)).hexdigest()


def decode_packed_mask(value: object, shape: tuple[int, int]) -> np.ndarray:
    """Decode one packed mask and discard byte-padding bits deterministically."""
    raw = base64.b64decode(str(value), validate=True)
    cell_count = int(shape[0] * shape[1])
    unpacked = np.unpackbits(
        np.frombuffer(raw, dtype=np.uint8), bitorder=PACKED_MASK_BIT_ORDER
    )
    if unpacked.size < cell_count:
        raise ValueError("Packed planning mask is shorter than its declared shape.")
    return unpacked[:cell_count].reshape(shape).astype(bool, copy=False)


def load_neighbor_structure(value: dict[str, object]) -> NeighborStructure:
    """Validate and load a persisted planning-structure manifest."""
    method = str(value.get("neighbor_method", NEIGHBOR_METHOD))
    version = int(value.get("neighbor_method_version", 0))
    if method != NEIGHBOR_METHOD or version != NEIGHBOR_METHOD_VERSION:
        raise ValueError("Unsupported planning-structure neighbor method.")
    raw_tiles = value.get("tiles")
    if not isinstance(raw_tiles, list):
        raise ValueError("Planning structure must contain a tile list.")
    tiles = tuple(dict(tile) for tile in raw_tiles if isinstance(tile, dict))
    if len(tiles) != len(raw_tiles):
        raise ValueError("Planning structure contains an invalid tile record.")
    return NeighborStructure(
        height=int(value["height"]),
        width=int(value["width"]),
        tile_size=int(value["tile_size"]),
        planning_unit_count=int(value["planning_unit_count"]),
        tiles=tiles,
        method=method,
        method_version=version,
    )


def iter_neighbor_edge_blocks(
    structure: NeighborStructure,
) -> Iterator[NeighborEdgeBlock]:
    """Emit typed right/down rook-edge blocks with deterministic seam ownership."""
    records = {
        (int(tile["row_start"]), int(tile["col_start"])): tile
        for tile in structure.tiles
    }
    for tile in structure.tiles:
        row_start = int(tile["row_start"])
        row_stop = int(tile["row_stop"])
        col_start = int(tile["col_start"])
        col_stop = int(tile["col_stop"])
        shape = (row_stop - row_start, col_stop - col_start)
        eligible = decode_packed_mask(tile["eligibility_mask"], shape)
        states = _decode_states(tile, shape)
        indices = _planning_indices(tile, eligible)

        first_parts: list[np.ndarray] = []
        second_parts: list[np.ndarray] = []
        first_state_parts: list[np.ndarray] = []
        second_state_parts: list[np.ndarray] = []

        horizontal_rows, horizontal_cols = np.where(
            eligible[:, :-1] & eligible[:, 1:]
        )
        first_parts.append(indices[horizontal_rows, horizontal_cols])
        second_parts.append(indices[horizontal_rows, horizontal_cols + 1])
        first_state_parts.append(states[horizontal_rows, horizontal_cols])
        second_state_parts.append(states[horizontal_rows, horizontal_cols + 1])
        vertical_rows, vertical_cols = np.where(
            eligible[:-1, :] & eligible[1:, :]
        )
        first_parts.append(indices[vertical_rows, vertical_cols])
        second_parts.append(indices[vertical_rows + 1, vertical_cols])
        first_state_parts.append(states[vertical_rows, vertical_cols])
        second_state_parts.append(states[vertical_rows + 1, vertical_cols])

        right = records.get((row_start, col_stop))
        if right is not None:
            right_shape = (
                int(right["row_stop"]) - int(right["row_start"]),
                int(right["col_stop"]) - int(right["col_start"]),
            )
            right_eligible = decode_packed_mask(right["eligibility_mask"], right_shape)
            right_states = _decode_states(right, right_shape)
            right_indices = _planning_indices(right, right_eligible)
            seam_rows = np.flatnonzero(eligible[:, -1] & right_eligible[:, 0])
            first_parts.append(indices[seam_rows, -1])
            second_parts.append(right_indices[seam_rows, 0])
            first_state_parts.append(states[seam_rows, -1])
            second_state_parts.append(right_states[seam_rows, 0])

        bottom = records.get((row_stop, col_start))
        if bottom is not None:
            bottom_shape = (
                int(bottom["row_stop"]) - int(bottom["row_start"]),
                int(bottom["col_stop"]) - int(bottom["col_start"]),
            )
            bottom_eligible = decode_packed_mask(
                bottom["eligibility_mask"], bottom_shape
            )
            bottom_states = _decode_states(bottom, bottom_shape)
            bottom_indices = _planning_indices(bottom, bottom_eligible)
            seam_cols = np.flatnonzero(eligible[-1, :] & bottom_eligible[0, :])
            first_parts.append(indices[-1, seam_cols])
            second_parts.append(bottom_indices[0, seam_cols])
            first_state_parts.append(states[-1, seam_cols])
            second_state_parts.append(bottom_states[0, seam_cols])

        first = np.concatenate(first_parts).astype(np.int64, copy=False)
        if first.size:
            yield NeighborEdgeBlock(
                first=first,
                second=np.concatenate(second_parts).astype(np.int64, copy=False),
                first_state=np.concatenate(first_state_parts).astype(
                    np.int8, copy=False
                ),
                second_state=np.concatenate(second_state_parts).astype(
                    np.int8, copy=False
                ),
            )


def count_neighbor_edges(structure: NeighborStructure) -> int:
    """Return the exact raw internal rook-edge count."""
    return sum(block.count for block in iter_neighbor_edge_blocks(structure))


def measure_neighbor_structure(
    structure: NeighborStructure,
) -> NeighborStructureCounts:
    """Classify raw edges before allocating any pairwise solver structures."""
    values = {
        "raw": 0,
        "constant": 0,
        "constant_selected": 0,
        "unary": 0,
        "fixed0_unary": 0,
        "fixed1_unary": 0,
        "pairwise": 0,
    }
    for block in iter_neighbor_edge_blocks(structure):
        first_fixed = block.first_state != 0
        second_fixed = block.second_state != 0
        constant = first_fixed & second_fixed
        unary = first_fixed ^ second_fixed
        fixed_state = np.where(first_fixed, block.first_state, block.second_state)
        values["raw"] += block.count
        values["constant"] += int(np.count_nonzero(constant))
        values["constant_selected"] += int(
            np.count_nonzero(
                constant
                & (block.first_state == 1)
                & (block.second_state == 1)
            )
        )
        values["unary"] += int(np.count_nonzero(unary))
        values["fixed0_unary"] += int(np.count_nonzero(unary & (fixed_state == -1)))
        values["fixed1_unary"] += int(np.count_nonzero(unary & (fixed_state == 1)))
        values["pairwise"] += int(np.count_nonzero(~first_fixed & ~second_fixed))
    return NeighborStructureCounts(**values)


def raw_neighbor_value(
    structure: NeighborStructure,
    decisions: Sequence[float] | np.ndarray,
    decision_domain: str = "discrete",
) -> float:
    """Return selected-pair count or continuous adjacent allocation intensity."""
    raw_values = np.asarray(decisions, dtype=np.float64)
    if len(raw_values) != structure.planning_unit_count:
        raise ValueError("Neighbor decisions do not match the planning-unit count.")
    if decision_domain == "continuous":
        values = np.clip(raw_values, 0.0, 1.0)
        return float(
            sum(
                np.sum(np.minimum(values[block.first], values[block.second]))
                for block in iter_neighbor_edge_blocks(structure)
            )
        )
    values = raw_values >= 0.5
    return float(
        sum(
            np.count_nonzero(values[block.first] & values[block.second])
            for block in iter_neighbor_edge_blocks(structure)
        )
    )


def planning_fixed_values(structure: NeighborStructure) -> np.ndarray:
    """Reconstruct authoritative -1/flexible, 0/fixed-out, 1/fixed-in states."""
    values = np.full(structure.planning_unit_count, -1, dtype=np.int8)
    for tile in structure.tiles:
        shape = (
            int(tile["row_stop"]) - int(tile["row_start"]),
            int(tile["col_stop"]) - int(tile["col_start"]),
        )
        eligible = decode_packed_mask(tile["eligibility_mask"], shape)
        indices = _planning_indices(tile, eligible)
        states = _decode_states(tile, shape)
        values[indices[eligible]] = np.where(
            states[eligible] == 0,
            -1,
            (states[eligible] == 1).astype(np.int8),
        )
    return values


def _planning_indices(tile: dict[str, object], eligible: np.ndarray) -> np.ndarray:
    """Derive dense run-local planning indices from mask rank and tile prefix."""
    values = np.full(eligible.shape, -1, dtype=np.int64)
    count = int(np.count_nonzero(eligible))
    values[eligible] = int(tile["variable_index_offset"]) + np.arange(
        count, dtype=np.int64
    )
    return values


def _decode_states(tile: dict[str, object], shape: tuple[int, int]) -> np.ndarray:
    """Decode fixed-zero/fixed-one masks into -1/0/1 domain states."""
    states = np.zeros(shape, dtype=np.int8)
    if "fixed0_mask" in tile:
        states[decode_packed_mask(tile["fixed0_mask"], shape)] = -1
    if "fixed1_mask" in tile:
        fixed_one = decode_packed_mask(tile["fixed1_mask"], shape)
        if np.any((states == -1) & fixed_one):
            raise ValueError("Planning structure contains conflicting fixed states.")
        states[fixed_one] = 1
    return states
