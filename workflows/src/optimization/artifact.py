from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Mapping, Sequence

import numpy as np

from .model import CompactRowNames, CompiledOptimizationModel


ARTIFACT_SCHEMA_VERSION = 3
COPY_CHUNK_ELEMENTS = 1_048_576


@dataclass(frozen=True)
class ArrayDescriptor:
    """Describe one checksummed typed numerical array in a compiled artifact."""

    path: str
    dtype: str
    shape: tuple[int, ...]
    byte_size: int
    checksum: str


@dataclass(frozen=True)
class RowBlock:
    """Describe a compact contiguous range of mathematically equivalent rows."""

    name: str
    start: int
    stop: int


@dataclass(frozen=True)
class CompiledArtifactManifest:
    """Contain compact provenance and identities for one immutable model artifact."""

    schema_version: int
    problem_definition_hash: str
    mathematical_model_hash: str
    artifact_content_hash: str
    objective_sense: str
    objective_offset: float
    variable_count: int
    constraint_count: int
    nonzero_count: int
    primary_variable_count: int
    fixed_in_count: int
    fixed_out_count: int
    arrays: Mapping[str, ArrayDescriptor]
    row_blocks: tuple[RowBlock, ...]
    provenance: Mapping[str, object]
    actual_dimensions: Mapping[str, int]


@dataclass(frozen=True)
class LoadedCompiledArtifact:
    """Expose verified file-backed model arrays and reconstruction mappings."""

    manifest: CompiledArtifactManifest
    model: CompiledOptimizationModel
    candidate_planning_unit_ids: np.ndarray
    candidate_source_indices: np.ndarray
    fixed_planning_unit_ids: np.ndarray
    fixed_source_indices: np.ndarray
    fixed_values: np.ndarray
    arrays: Mapping[str, np.ndarray]


def write_compiled_artifact(
    model: CompiledOptimizationModel,
    directory: str | Path,
    *,
    problem_definition_hash: str,
    candidate_planning_unit_ids: np.ndarray | Sequence[int],
    candidate_source_indices: np.ndarray | Sequence[int] = (),
    fixed_planning_unit_ids: np.ndarray | Sequence[int] = (),
    fixed_source_indices: np.ndarray | Sequence[int] = (),
    fixed_values: np.ndarray | Sequence[int] = (),
    provenance: Mapping[str, object] | None = None,
    actual_dimensions: Mapping[str, int] | None = None,
    additional_arrays: Mapping[str, np.ndarray] | None = None,
) -> CompiledArtifactManifest:
    """Write one manifest-last immutable compiled artifact with bounded copies."""
    destination = Path(directory)
    destination.mkdir(parents=True, exist_ok=True)
    manifest_path = destination / "manifest.json"
    candidate_ids = np.asanyarray(candidate_planning_unit_ids, dtype=np.uint64)
    candidate_sources = np.asanyarray(candidate_source_indices, dtype=np.int64)
    fixed_ids = np.asanyarray(fixed_planning_unit_ids, dtype=np.uint64)
    fixed_sources = np.asanyarray(fixed_source_indices, dtype=np.int64)
    fixed_state = np.asanyarray(fixed_values, dtype=np.int8)
    primary_count = len(candidate_ids)
    if primary_count > model.variable_count:
        raise ValueError("Candidate mapping exceeds the solver column count.")
    if candidate_sources.size == 0 and primary_count:
        candidate_sources = np.arange(primary_count, dtype=np.int64)
    if candidate_sources.shape != candidate_ids.shape:
        raise ValueError("Candidate source indices must align with solver columns.")
    if fixed_sources.size == 0 and fixed_ids.size:
        fixed_sources = np.arange(
            primary_count,
            primary_count + len(fixed_ids),
            dtype=np.int64,
        )
    if (
        fixed_ids.shape != fixed_state.shape
        or fixed_ids.shape != fixed_sources.shape
        or fixed_ids.ndim != 1
    ):
        raise ValueError("Fixed planning-unit IDs and values must align.")
    if np.any(~np.isin(fixed_state, (0, 1))):
        raise ValueError("Fixed reconstruction values must be zero or one.")
    if candidate_sources.size > 1 and np.any(
        candidate_sources[1:] <= candidate_sources[:-1]
    ):
        raise ValueError("Candidate source indices must be strictly increasing.")
    if fixed_sources.size > 1 and np.any(fixed_sources[1:] <= fixed_sources[:-1]):
        raise ValueError("Fixed source indices must be strictly increasing.")
    model_hash = mathematical_model_hash(model, candidate_ids)
    if manifest_path.exists():
        existing = load_compiled_artifact(destination).manifest
        if (
            existing.problem_definition_hash == problem_definition_hash
            and existing.mathematical_model_hash == model_hash
        ):
            return existing
        raise FileExistsError(
            f"A different compiled artifact is already committed: {manifest_path}"
        )

    values: dict[str, np.ndarray] = {
        "objective": np.asanyarray(model.objective),
        "variable_lower": np.asanyarray(model.variable_lower),
        "variable_upper": np.asanyarray(model.variable_upper),
        "integrality": np.asanyarray(model.integrality),
        "row_lower": np.asanyarray(model.row_lower),
        "row_upper": np.asanyarray(model.row_upper),
        "matrix_starts": np.asanyarray(model.row_starts),
        "matrix_indices": np.asanyarray(model.column_indices),
        "matrix_values": np.asanyarray(model.coefficients),
        "candidate_planning_unit_ids": candidate_ids,
        "candidate_source_indices": candidate_sources,
        "fixed_planning_unit_ids": fixed_ids,
        "fixed_source_indices": fixed_sources,
        "fixed_values": fixed_state,
    }
    for name, array in (additional_arrays or {}).items():
        if name in values:
            raise ValueError(f"Additional artifact array has a reserved name: {name}.")
        values[name] = np.asanyarray(array)
    descriptors: dict[str, ArrayDescriptor] = {}
    for name, array in values.items():
        descriptors[name] = _write_array(destination / f"{name}.npy", array)

    row_blocks = compact_row_blocks(model.row_names)
    content_hash = _artifact_content_hash(descriptors, row_blocks)
    dimensions = {
        "actual_candidate_count": primary_count,
        "actual_variable_count": model.variable_count,
        "actual_row_count": model.constraint_count,
        "actual_nonzero_count": model.nonzero_count,
        "actual_artifact_bytes": sum(value.byte_size for value in descriptors.values()),
        **(dict(actual_dimensions) if actual_dimensions is not None else {}),
    }
    manifest = CompiledArtifactManifest(
        schema_version=ARTIFACT_SCHEMA_VERSION,
        problem_definition_hash=problem_definition_hash,
        mathematical_model_hash=model_hash,
        artifact_content_hash=content_hash,
        objective_sense="maximize" if model.maximize else "minimize",
        objective_offset=float(model.objective_offset),
        variable_count=model.variable_count,
        constraint_count=model.constraint_count,
        nonzero_count=model.nonzero_count,
        primary_variable_count=primary_count,
        fixed_in_count=int(np.count_nonzero(fixed_state == 1)),
        fixed_out_count=int(np.count_nonzero(fixed_state == 0)),
        arrays=descriptors,
        row_blocks=row_blocks,
        provenance=dict(provenance or {}),
        actual_dimensions=dimensions,
    )
    temporary = destination / ".manifest.json.partial"
    temporary.write_text(
        json.dumps(
            _manifest_to_dict(manifest),
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    os.replace(temporary, manifest_path)
    return manifest


def load_compiled_artifact(directory: str | Path) -> LoadedCompiledArtifact:
    """Verify and memory-map one committed compiled optimization artifact."""
    root = Path(directory)
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("Compiled artifact has no committed manifest.")
    manifest = _manifest_from_dict(json.loads(manifest_path.read_text("utf-8")))
    if manifest.schema_version != ARTIFACT_SCHEMA_VERSION:
        raise ValueError("Unsupported compiled artifact schema version.")
    if _artifact_content_hash(manifest.arrays, manifest.row_blocks) != (
        manifest.artifact_content_hash
    ):
        raise ValueError("Compiled artifact content identity is invalid.")

    arrays: dict[str, np.ndarray] = {}
    for name, descriptor in manifest.arrays.items():
        path = root / descriptor.path
        if _sha256(path) != descriptor.checksum:
            raise ValueError(f"Compiled artifact checksum mismatch: {name}.")
        array = np.load(path, mmap_mode="r", allow_pickle=False)
        if array.shape != descriptor.shape or array.dtype.str != descriptor.dtype:
            raise ValueError(f"Compiled artifact array contract mismatch: {name}.")
        arrays[name] = array

    model = CompiledOptimizationModel(
        objective=arrays["objective"],
        variable_lower=arrays["variable_lower"],
        variable_upper=arrays["variable_upper"],
        integrality=arrays["integrality"],
        row_starts=arrays["matrix_starts"],
        column_indices=arrays["matrix_indices"],
        coefficients=arrays["matrix_values"],
        row_lower=arrays["row_lower"],
        row_upper=arrays["row_upper"],
        row_names=_expand_row_blocks(manifest.row_blocks, manifest.constraint_count),
        primary_variable_count=manifest.primary_variable_count,
        maximize=manifest.objective_sense == "maximize",
        objective_offset=manifest.objective_offset,
    )
    if mathematical_model_hash(
        model, arrays["candidate_planning_unit_ids"]
    ) != manifest.mathematical_model_hash:
        raise ValueError("Compiled artifact mathematical-model hash is invalid.")
    return LoadedCompiledArtifact(
        manifest=manifest,
        model=model,
        candidate_planning_unit_ids=arrays["candidate_planning_unit_ids"],
        candidate_source_indices=arrays["candidate_source_indices"],
        fixed_planning_unit_ids=arrays["fixed_planning_unit_ids"],
        fixed_source_indices=arrays["fixed_source_indices"],
        fixed_values=arrays["fixed_values"],
        arrays=arrays,
    )


def mathematical_model_hash(
    model: CompiledOptimizationModel,
    candidate_planning_unit_ids: np.ndarray | Sequence[int],
) -> str:
    """Hash mathematical semantics independently from artifact file layout."""
    digest = hashlib.sha256()
    digest.update(b"compiled-mathematical-model-v1\0")
    digest.update(b"maximize\0" if model.maximize else b"minimize\0")
    digest.update(np.asarray([model.objective_offset], dtype="<f8").tobytes())
    for name, array, dtype in (
        ("objective", model.objective, "<f8"),
        ("variable_lower", model.variable_lower, "<f8"),
        ("variable_upper", model.variable_upper, "<f8"),
        ("integrality", model.integrality, "u1"),
        ("row_lower", model.row_lower, "<f8"),
        ("row_upper", model.row_upper, "<f8"),
        ("matrix_starts", model.row_starts, "<i8"),
        ("matrix_indices", model.column_indices, "<i8"),
        ("matrix_values", model.coefficients, "<f8"),
        ("candidate_ids", candidate_planning_unit_ids, "<u8"),
    ):
        digest.update(name.encode("utf-8") + b"\0")
        _update_array_hash(digest, np.asanyarray(array), np.dtype(dtype))
    return digest.hexdigest()


def compact_row_blocks(row_names: Sequence[str]) -> tuple[RowBlock, ...]:
    """Compress repeated row roles into bounded contiguous range metadata."""
    if isinstance(row_names, CompactRowNames):
        return tuple(RowBlock(*block) for block in row_names.blocks)
    if not row_names:
        return ()
    blocks: list[RowBlock] = []
    start = 0
    current = _row_role(row_names[0])
    for index, name in enumerate(row_names[1:], start=1):
        role = _row_role(name)
        if role == current:
            continue
        blocks.append(RowBlock(current, start, index))
        current = role
        start = index
    blocks.append(RowBlock(current, start, len(row_names)))
    return tuple(blocks)


def _write_array(path: Path, values: np.ndarray) -> ArrayDescriptor:
    array = np.asanyarray(values)
    source_path = (
        Path(str(array.filename)).resolve()
        if isinstance(array, np.memmap) and getattr(array, "filename", None)
        else None
    )
    if source_path == path.resolve():
        array.flush()
        return ArrayDescriptor(
            path=path.name,
            dtype=array.dtype.str,
            shape=tuple(int(value) for value in array.shape),
            byte_size=path.stat().st_size,
            checksum=_sha256(path),
        )
    destination = np.lib.format.open_memmap(
        path,
        mode="w+",
        dtype=array.dtype,
        shape=array.shape,
    )
    flat_source = array.reshape(-1)
    flat_destination = destination.reshape(-1)
    for start in range(0, flat_source.size, COPY_CHUNK_ELEMENTS):
        stop = min(start + COPY_CHUNK_ELEMENTS, flat_source.size)
        flat_destination[start:stop] = flat_source[start:stop]
    destination.flush()
    del destination
    return ArrayDescriptor(
        path=path.name,
        dtype=array.dtype.str,
        shape=tuple(int(value) for value in array.shape),
        byte_size=path.stat().st_size,
        checksum=_sha256(path),
    )


def _row_role(name: str) -> str:
    if name.startswith("neighbor_selected_first_"):
        return "neighbor_selected_first"
    if name.startswith("neighbor_selected_second_"):
        return "neighbor_selected_second"
    return name


def _expand_row_blocks(
    blocks: Sequence[RowBlock], row_count: int
) -> CompactRowNames:
    compact: list[tuple[str, int, int]] = []
    expected_start = 0
    for block in blocks:
        if block.start < 0 or block.stop < block.start or block.stop > row_count:
            raise ValueError("Compiled artifact row block is out of range.")
        if block.start != expected_start:
            raise ValueError("Compiled artifact row blocks do not cover every row.")
        compact.append((block.name, block.start, block.stop))
        expected_start = block.stop
    if expected_start != row_count:
        raise ValueError("Compiled artifact row blocks do not cover every row.")
    return CompactRowNames(compact, row_count)


def _artifact_content_hash(
    arrays: Mapping[str, ArrayDescriptor], row_blocks: Sequence[RowBlock]
) -> str:
    value = {
        "schema_version": ARTIFACT_SCHEMA_VERSION,
        "arrays": {name: asdict(arrays[name]) for name in sorted(arrays)},
        "row_blocks": [asdict(block) for block in row_blocks],
    }
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _update_array_hash(
    digest: "hashlib._Hash", values: np.ndarray, dtype: np.dtype
) -> None:
    normalized = np.asarray(values, dtype=dtype).reshape(-1)
    digest.update(np.asarray(values.shape, dtype="<i8").tobytes())
    for start in range(0, normalized.size, COPY_CHUNK_ELEMENTS):
        stop = min(start + COPY_CHUNK_ELEMENTS, normalized.size)
        digest.update(normalized[start:stop].tobytes(order="C"))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_to_dict(manifest: CompiledArtifactManifest) -> dict[str, object]:
    value = asdict(manifest)
    value["arrays"] = {
        name: asdict(descriptor) for name, descriptor in manifest.arrays.items()
    }
    return value


def _manifest_from_dict(value: Mapping[str, object]) -> CompiledArtifactManifest:
    raw_arrays = value.get("arrays")
    if not isinstance(raw_arrays, dict):
        raise ValueError("Compiled artifact manifest arrays are invalid.")
    arrays = {
        str(name): ArrayDescriptor(
            path=str(descriptor["path"]),
            dtype=str(descriptor["dtype"]),
            shape=tuple(int(item) for item in descriptor["shape"]),
            byte_size=int(descriptor["byte_size"]),
            checksum=str(descriptor["checksum"]),
        )
        for name, descriptor in raw_arrays.items()
        if isinstance(descriptor, dict)
    }
    raw_blocks = value.get("row_blocks")
    blocks = tuple(
        RowBlock(
            name=str(block["name"]),
            start=int(block["start"]),
            stop=int(block["stop"]),
        )
        for block in raw_blocks
        if isinstance(block, dict)
    ) if isinstance(raw_blocks, list) else ()
    return CompiledArtifactManifest(
        schema_version=int(value["schema_version"]),
        problem_definition_hash=str(value["problem_definition_hash"]),
        mathematical_model_hash=str(value["mathematical_model_hash"]),
        artifact_content_hash=str(value["artifact_content_hash"]),
        objective_sense=str(value["objective_sense"]),
        objective_offset=float(value["objective_offset"]),
        variable_count=int(value["variable_count"]),
        constraint_count=int(value["constraint_count"]),
        nonzero_count=int(value["nonzero_count"]),
        primary_variable_count=int(value["primary_variable_count"]),
        fixed_in_count=int(value["fixed_in_count"]),
        fixed_out_count=int(value["fixed_out_count"]),
        arrays=arrays,
        row_blocks=blocks,
        provenance=dict(value.get("provenance") or {}),
        actual_dimensions={
            str(name): int(item)
            for name, item in dict(value.get("actual_dimensions") or {}).items()
        },
    )
