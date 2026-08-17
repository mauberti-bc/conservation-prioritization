import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Any, Callable, Dict, Literal

import numpy as np
from prefect import get_run_logger, task
from prefect.runtime import flow_run

from ..tasks.spatial_compilation import (
    OptimizationParameters,
    compile_prepared_artifact,
    count_planning_tile,
    finalize_planning_inventory,
    finalize_spatial_preparation,
    initialize_planning_grid,
    prepare_planning_tile,
)
from ..optimization.grid import iter_grid_tiles
from ..optimization.admission import (
    SparseExecutionProfile,
    SparseModelDimensions,
    admit_sparse_model,
    admit_structural_inventory,
)
from ..optimization.canonical_result import write_solver_canonical_zarr
from ..optimization.highs import require_acceptable_result, solve_with_highs
from ..optimization.model import SolveConfiguration
from ..optimization.artifact import load_compiled_artifact
from ..optimization.neighbor import load_neighbor_structure, raw_neighbor_value
from ..optimization.priority_ranking import (
    PRIORITY_BUDGET_FRACTIONS,
    solve_priority_ranking,
)
from ..optimization.validation import reconstruct_and_validate
from ..publication.parquet_export import export_selected_parquet
from ..utils.object_store import (
    build_object_key,
    download_object,
    get_object_store_config,
    parse_uri,
    put_object,
)
from ..utils.env import parse_int_setting
from ..utils.internal_api import internal_api_request
from ..utils.scratch import (
    cleanup_scratch_directory,
    enforce_scratch_limit,
    task_run_scratch_directory,
)
from ..utils.task_run_concurrency import acquire_task_run_slot


DecisionDomain = Literal["continuous", "discrete"]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class CompiledRunPreparation:
    """File-backed compilation outputs retained after the Dask child flow exits."""

    preparation_directory: str
    preparation_manifest: Dict[str, Any]
    canonical_path: str


def _submit_in_bounded_waves(records: list[Dict[str, Any]], submit_record: Any) -> None:
    """Submit tile tasks in bounded waves and surface failures before continuing."""
    wave_size = int(os.getenv("SPATIAL_TILE_SUBMISSION_WAVE", "32"))
    if wave_size <= 0:
        raise ValueError("SPATIAL_TILE_SUBMISSION_WAVE must be positive.")
    for start in range(0, len(records), wave_size):
        futures = [
            submit_record(record) for record in records[start : start + wave_size]
        ]
        for future in futures:
            future.result()


@task(retries=3, retry_delay_seconds=2)
def resolve_run(task_run_id: str) -> Dict[str, Any]:
    """Resolve the immutable run snapshot by reference."""
    return internal_api_request("GET", f"/internal/run/{task_run_id}")


@task(retries=3, retry_delay_seconds=2)
def update_run(task_run_id: str, **updates: Any) -> Dict[str, Any]:
    """Persist run lifecycle state before it is observable by clients."""
    return internal_api_request("POST", f"/internal/run/{task_run_id}/status", updates)


@task(retries=3, retry_delay_seconds=2)
def update_artifact(
    task_run_id: str, artifact_type: str, **updates: Any
) -> Dict[str, Any]:
    """Persist artifact state and its authoritative finalization manifest."""
    return internal_api_request(
        "POST", f"/internal/run/{task_run_id}/artifact/{artifact_type}", updates
    )


@task(retries=3, retry_delay_seconds=2)
def update_solution(task_run_id: str, **solution: Any) -> Dict[str, Any]:
    """Persist normalized metadata for the reference optimization solution."""
    return internal_api_request(
        "POST", f"/internal/run/{task_run_id}/solution", solution
    )


@task
def build_parameters(run: Dict[str, Any]) -> OptimizationParameters:
    """Translate the immutable domain snapshot into compilation parameters."""
    snapshot = run["input_snapshot"]
    return OptimizationParameters(
        target_area=snapshot["target_area"],
        resolution=int(
            snapshot.get("planning_unit_resolution", snapshot.get("resolution"))
        ),
        resampling=snapshot.get("resampling", "mode"),
        objectives=snapshot["objectives"],
        constraints=snapshot.get("constraints", []),
        layer_contracts=snapshot["layer_contracts"],
        grid_extent=run["planning_unit_definition"].get("extent"),
        neighbor_penalty=snapshot.get("neighbor_penalty"),
        decision_domain=str(snapshot.get("decision_domain", "discrete")),
        preserve_primary_domain=bool(snapshot.get("preserve_primary_domain", False)),
        allocation_target_row=bool(snapshot.get("allocation_target_row", False)),
    )


def _upload_finalized_artifact(
    task_run_id: str,
    artifact_type: str,
    path: Path,
    content_type: str,
) -> Dict[str, Any]:
    config = get_object_store_config()
    checksum = _sha256(path)
    key = build_object_key(f"runs/{task_run_id}/{artifact_type}/{checksum}/{path.name}")
    uploaded = put_object(
        local_path=str(path),
        bucket=config.bucket,
        key=key,
        content_type=content_type,
        metadata={"task_run_id": task_run_id, "sha256": checksum},
    )
    manifest = {
        "schema_version": 1,
        "commit_protocol": "manifest_last",
        "task_run_id": task_run_id,
        "artifact_type": artifact_type,
        "partitions": [
            {
                "uri": uploaded["uri"],
                "checksum": checksum,
                "size_bytes": path.stat().st_size,
            }
        ],
        "partition_count": 1,
    }
    return {
        "status": "ready",
        "uri": uploaded["uri"],
        "content_type": content_type,
        "checksum": checksum,
        "size_bytes": path.stat().st_size,
        "manifest": manifest,
    }


def _upload_compiled_artifact(
    task_run_id: str,
    directory: Path,
) -> Dict[str, Any]:
    """Upload one numerical compiled artifact and commit its remote manifest last."""
    local_manifest_path = directory / "manifest.json"
    if not local_manifest_path.exists():
        raise RuntimeError("Compiled model has no committed local manifest.")
    compiled_manifest = json.loads(local_manifest_path.read_text(encoding="utf-8"))
    config = get_object_store_config()
    remote_parts: list[Dict[str, Any]] = []
    array_paths = sorted(
        directory / str(descriptor["path"])
        for descriptor in compiled_manifest["arrays"].values()
    )
    for path in array_paths:
        checksum = _sha256(path)
        key = build_object_key(f"runs/{task_run_id}/compiled_model/parts/{path.name}")
        uploaded = put_object(
            local_path=str(path),
            bucket=config.bucket,
            key=key,
            content_type="application/octet-stream",
            metadata={"task_run_id": task_run_id, "sha256": checksum},
        )
        remote_parts.append(
            {
                "name": path.name,
                "uri": uploaded["uri"],
                "checksum": checksum,
                "size_bytes": path.stat().st_size,
            }
        )
    remote_manifest = {
        "schema_version": 1,
        "artifact_type": "compiled_model",
        "commit_protocol": "manifest_last",
        "task_run_id": task_run_id,
        "compiled_model": compiled_manifest,
        "parts": remote_parts,
    }
    remote_manifest_path = directory.parent / "compiled-model-remote-manifest.json"
    remote_manifest_path.write_text(
        json.dumps(remote_manifest, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    checksum = _sha256(remote_manifest_path)
    key = build_object_key(
        f"runs/{task_run_id}/compiled_model/manifest-{checksum}.json"
    )
    uploaded = put_object(
        local_path=str(remote_manifest_path),
        bucket=config.bucket,
        key=key,
        content_type="application/json",
        metadata={"task_run_id": task_run_id, "sha256": checksum},
    )
    return {
        "status": "ready",
        "uri": uploaded["uri"],
        "content_type": "application/json",
        "checksum": checksum,
        "size_bytes": remote_manifest_path.stat().st_size,
        "manifest": {
            "schema_version": 1,
            "artifact_type": "compiled_model",
            "commit_protocol": "manifest_last",
            "remote_manifest_uri": uploaded["uri"],
            "remote_manifest_checksum": checksum,
            "remote_manifest_size_bytes": remote_manifest_path.stat().st_size,
            "part_count": len(remote_parts),
            "compiled_model_schema_version": compiled_manifest.get("schema_version"),
            "mathematical_model_hash": compiled_manifest.get(
                "mathematical_model_hash"
            ),
            "artifact_content_hash": compiled_manifest.get("artifact_content_hash"),
        },
    }


def _upload_zarr_artifact(task_run_id: str, directory: Path) -> Dict[str, Any]:
    """Upload all committed Zarr parts and publish its remote manifest last."""
    local_manifest = json.loads(
        (directory / "manifest.json").read_text(encoding="utf-8")
    )
    config = get_object_store_config()
    content_root = local_manifest["content_root"]
    remote_parts: list[Dict[str, Any]] = []
    for part in local_manifest["partitions"]:
        path = directory / part["path"]
        key = build_object_key(
            f"runs/{task_run_id}/canonical_result/{content_root}/{part['path']}"
        )
        uploaded = put_object(
            local_path=str(path),
            bucket=config.bucket,
            key=key,
            content_type="application/octet-stream",
            metadata={"task_run_id": task_run_id, "sha256": part["checksum"]},
        )
        remote_parts.append({**part, "uri": uploaded["uri"]})
    remote_manifest = {**local_manifest, "partitions": remote_parts}
    manifest_path = directory.parent / "canonical-zarr-manifest.json"
    manifest_path.write_text(
        json.dumps(remote_manifest, sort_keys=True, separators=(",", ":")),
        encoding="utf-8",
    )
    checksum = _sha256(manifest_path)
    uploaded_manifest = put_object(
        local_path=str(manifest_path),
        bucket=config.bucket,
        key=build_object_key(
            f"runs/{task_run_id}/canonical_result/manifest-{checksum}.json"
        ),
        content_type="application/json",
        metadata={"task_run_id": task_run_id, "sha256": checksum},
    )
    return {
        "status": "ready",
        "uri": uploaded_manifest["uri"],
        "content_type": "application/vnd.zarr+json",
        "checksum": checksum,
        "size_bytes": sum(int(part["size_bytes"]) for part in remote_parts),
        "manifest": {
            "schema_version": 1,
            "artifact_type": "canonical_result",
            "commit_protocol": "manifest_last",
            "remote_manifest_uri": uploaded_manifest["uri"],
            "remote_manifest_checksum": checksum,
            "remote_manifest_size_bytes": manifest_path.stat().st_size,
            "partition_count": len(remote_parts),
            "content_root": local_manifest.get("content_root"),
            "surface": local_manifest.get("surface"),
        },
    }


@task
def evaluate_count_admission(
    planning_unit_count: int,
    planning_unit_resolution: int,
) -> Dict[str, Any]:
    """Record exact N before structural measurement without imposing an N ceiling."""
    del planning_unit_resolution
    profile = _sparse_execution_profile()
    return asdict(admit_structural_inventory(planning_unit_count, profile))


@task
def evaluate_sparse_admission(
    planning_unit_count: int,
    feature_nonzero_count: int,
    neighbor_edge_count: int,
    constraint_row_count: int,
    matrix_nonzero_count: int,
    auxiliary_variable_count: int = 0,
    primary_variable_count: int | None = None,
) -> Dict[str, Any]:
    """Admit a sparse model using measured V, R, Z and profile resources."""
    profile = _sparse_execution_profile()
    dimensions = SparseModelDimensions(
        planning_units=planning_unit_count,
        primary_variables=(
            planning_unit_count
            if primary_variable_count is None
            else primary_variable_count
        ),
        auxiliary_variables=auxiliary_variable_count,
        constraint_rows=constraint_row_count,
        matrix_nonzeros=matrix_nonzero_count,
        feature_nonzeros=feature_nonzero_count,
        neighbor_edges=neighbor_edge_count,
    )
    return asdict(admit_sparse_model(dimensions, profile))


def _sparse_execution_profile() -> SparseExecutionProfile:
    """Load the selected deployment's resource capacity from environment."""
    default_peak = 8 * 1024**3
    default_scratch = 64 * 1024**3
    return SparseExecutionProfile(
        name=os.getenv(
            "SPARSE_EXECUTION_PROFILE",
            "compiled-optimization",
        ),
        max_peak_memory_bytes=parse_int_setting(
            os.getenv(
                "SPARSE_PROFILE_MAX_PEAK_MEMORY_BYTES",
                str(default_peak),
            ),
            "SPARSE_PROFILE_MAX_PEAK_MEMORY_BYTES",
        ),
        max_scratch_bytes=parse_int_setting(
            os.getenv("SPARSE_PROFILE_MAX_SCRATCH_BYTES", str(default_scratch)),
            "SPARSE_PROFILE_MAX_SCRATCH_BYTES",
        ),
        safety_factor=float(os.getenv("SPARSE_ADMISSION_SAFETY_FACTOR", "1.5")),
    )


@task(name="solve_compiled_model")
def _solve_compiled_model(
    task_run_id: str,
    snapshot: Dict[str, Any],
    preparation_manifest: Dict[str, Any],
    preparation_dir: Path,
    output_dir: Path,
    canonical_path: Path,
    grid_definition: Dict[str, Any],
    decision_domain: DecisionDomain,
) -> str:
    """Solve, validate, reconstruct, and materialize one reference solution."""
    logger = get_run_logger()
    work_budget = snapshot.get("work_budget", {})
    time_limit = float(
        work_budget.get(
            "wall_time_seconds", os.getenv("HIGHS_TIME_LIMIT_SECONDS", "86400")
        )
    )
    target_gap = float(work_budget.get("relative_gap", 0.15))
    last_progress_update = 0.0
    artifact = load_compiled_artifact(preparation_dir / "compiled-model")

    def validate_result(result: Any) -> Any:
        """Apply the independent numerical acceptance gate before publication."""
        validation = reconstruct_and_validate(
            artifact.model,
            result,
            candidate_planning_unit_ids=artifact.candidate_planning_unit_ids,
            fixed_planning_unit_ids=artifact.fixed_planning_unit_ids,
            fixed_values=artifact.fixed_values,
            collect_selected_ids=False,
        )
        if not validation.accepted:
            raise RuntimeError(
                "Authoritative solution validation failed: "
                f"{', '.join(validation.failures)}."
            )
        return validation

    def report_progress(progress: dict[str, object]) -> None:
        nonlocal last_progress_update
        current = time.monotonic()
        completed = progress.get("completed_work_units")
        maximum = progress.get("maximum_work_units")
        if current - last_progress_update < 5.0 and completed != maximum:
            return
        last_progress_update = current
        memory = progress.get("memory")
        logger.info(
            "HiGHS %s: elapsed=%.1fs memory=%s",
            progress.get("phase", "solving"),
            float(progress.get("elapsed_seconds", 0.0)),
            memory,
        )
        update_run(task_run_id, stage="solving", progress=progress)

    planning_paths = sorted((preparation_dir / "planning-units").glob("*.parquet"))
    configuration = SolveConfiguration(
        time_limit_seconds=time_limit,
        relative_mip_gap=target_gap,
        thread_count=(
            int(work_budget["thread_count"])
            if work_budget.get("thread_count") is not None
            else None
        ),
        random_seed=int(work_budget.get("random_seed", 0)),
        mode=(
            "exact_audit"
            if snapshot.get("optimization_mode") == "exact_audit"
            else "standard"
        ),
        options=_priority_solver_options(),
    )
    with acquire_task_run_slot():
        result = solve_with_highs(
            artifact.model,
            configuration=configuration,
            progress_callback=report_progress,
        )
    require_acceptable_result(result, configuration, artifact.model)
    validation = validate_result(result)
    source_decisions = _reconstruct_source_decisions(
        result,
        artifact,
        int(preparation_manifest["planning_unit_count"]),
        output_dir / "decision-vectors" / "reference.npy",
    )
    result = _reconstruct_scientific_result(
        result,
        source_decisions,
        artifact,
        preparation_dir,
        snapshot,
    )
    raw_path = output_dir / "solver-result.npz"
    np.savez_compressed(
        raw_path,
        decisions=result.decisions,
        solver_status=result.status,
        objective_value=result.objective_value,
        best_bound=result.best_bound,
        optimality_gap=result.optimality_gap,
        termination_reason=result.termination_reason,
        raw_conservation_benefit=result.raw_conservation_benefit,
        raw_neighbor_value=result.raw_neighbor_value,
        neighbor_penalty_contribution=result.neighbor_penalty_contribution,
    )
    write_solver_canonical_zarr(
        canonical_path,
        planning_paths,
        result.decisions,
        height=int(preparation_manifest["height"]),
        width=int(preparation_manifest["width"]),
        chunk_size=int(preparation_manifest["tile_size"]),
        transform=preparation_manifest["transform"],
        crs=preparation_manifest["crs"],
        planning_unit_resolution=int(preparation_manifest["resolution"]),
        grid_family_id=grid_definition["grid_family_id"],
        grid_level=int(grid_definition["grid_level"]),
        full_grid_width=int(preparation_manifest["full_grid_width"]),
        global_row_offset=int(preparation_manifest["global_row_offset"]),
        global_col_offset=int(preparation_manifest["global_col_offset"]),
        surface="allocation" if decision_domain == "continuous" else "decision",
    )

    raw_metadata = _upload_finalized_artifact(
        task_run_id, "raw_solver_result", raw_path, "application/octet-stream"
    )
    update_artifact(task_run_id, "raw_solver_result", **raw_metadata)
    cleanup_scratch_directory(preparation_dir)
    cleanup_scratch_directory(output_dir / "decision-vectors")
    enforce_scratch_limit(output_dir, "optimization materialization")
    resource_rows = [
        row_index
        for row_index, row_name in enumerate(artifact.model.row_names)
        if row_name in {"selection_cap", "cost_cap"}
    ]
    resource_value = None
    if len(resource_rows) == 1:
        row_index = resource_rows[0]
        start = int(artifact.model.row_starts[row_index])
        stop = int(artifact.model.row_starts[row_index + 1])
        resource_value = float(
            np.dot(
                artifact.model.coefficients[start:stop],
                result.native_columns[artifact.model.column_indices[start:stop]],
            )
        )
    update_solution(
        task_run_id,
        solution_index=0,
        role="reference",
        status=result.status,
        objective_value=result.objective_value,
        resource_value=resource_value,
        selected_planning_unit_count=(
            int(np.count_nonzero(result.decisions >= 0.5))
            if decision_domain == "discrete"
            else None
        ),
        optimality_gap=result.optimality_gap,
        solver_name=result.solver_name,
        solver_version=result.solver_version,
        runtime_seconds=result.runtime_seconds,
        metrics={
            "task_type": (
                "continuous_optimization"
                if decision_domain == "continuous"
                else "discrete_optimization"
            ),
            "decision_domain": decision_domain,
            "allocation_total": (
                float(np.sum(result.decisions))
                if decision_domain == "continuous"
                else None
            ),
            "best_bound": result.best_bound,
            "termination_reason": result.termination_reason,
            "raw_conservation_benefit": result.raw_conservation_benefit,
            "raw_neighbor_value": result.raw_neighbor_value,
            "neighbor_penalty_contribution": result.neighbor_penalty_contribution,
            "objective_components": (result.diagnostics or {}).get(
                "objective_components", []
            ),
            "neighbor_normalization": artifact.manifest.provenance.get(
                "neighbor_penalty"
            ),
            "objective_offset": artifact.model.objective_offset,
            "solver_settings": result.solver_settings,
            "solver_memory_profile": result.memory_profile,
            "authoritative_validation": {
                "accepted": validation.accepted,
                "objective_value": validation.objective_value,
                "maximum_row_violation": validation.maximum_row_violation,
                "maximum_bound_violation": validation.maximum_bound_violation,
                "maximum_integrality_violation": (
                    validation.maximum_integrality_violation
                ),
                "failures": list(validation.failures),
            },
        },
    )
    update_run(
        task_run_id,
        stage="materializing",
        solver_name=result.solver_name,
        solver_version=result.solver_version,
        solver_status=result.status,
        objective_value=result.objective_value,
        optimality_gap=result.optimality_gap,
        runtime_seconds=result.runtime_seconds,
    )
    return result.status


def _reconstruct_source_decisions(
    result: Any,
    artifact: Any,
    planning_unit_count: int,
    output_path: Path,
) -> np.ndarray:
    """Restore source ordering into a file-backed, bounded-memory vector."""
    columns = np.asarray(result.native_columns, dtype=np.float64)
    candidate_sources = np.asarray(artifact.candidate_source_indices, dtype=np.int64)
    fixed_sources = np.asarray(artifact.fixed_source_indices, dtype=np.int64)
    fixed_values = np.asarray(artifact.fixed_values, dtype=np.float32)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    decisions = np.lib.format.open_memmap(
        output_path,
        mode="w+",
        dtype=np.float32,
        shape=(planning_unit_count,),
    )
    if len(candidate_sources) + len(fixed_sources) != planning_unit_count:
        raise RuntimeError("Artifact reconstruction did not cover every planning unit.")
    batch_size = 1_048_576
    for start in range(0, len(candidate_sources), batch_size):
        stop = min(start + batch_size, len(candidate_sources))
        decisions[candidate_sources[start:stop]] = columns[start:stop]
    for start in range(0, len(fixed_sources), batch_size):
        stop = min(start + batch_size, len(fixed_sources))
        decisions[fixed_sources[start:stop]] = fixed_values[start:stop]
    decisions.flush()
    return decisions


def _reconstruct_scientific_result(
    result: Any,
    decisions: np.ndarray,
    artifact: Any,
    preparation_directory: Path,
    snapshot: Dict[str, Any],
) -> Any:
    """Reconstruct objective components from immutable compiled coefficients."""
    conservation_benefit = 0.0
    objective_components: list[Dict[str, Any]] = []
    raw_objectives = artifact.manifest.provenance.get("objectives")
    if not isinstance(raw_objectives, list):
        raise RuntimeError("Compiled objective provenance is incomplete.")
    for raw_objective in raw_objectives:
        if not isinstance(raw_objective, dict):
            raise RuntimeError("Compiled objective provenance is invalid.")
        indices_name = str(raw_objective["canonical_indices_array"])
        values_name = str(raw_objective["canonical_values_array"])
        indices = np.asarray(artifact.arrays[indices_name], dtype=np.int64)
        values = np.asarray(artifact.arrays[values_name], dtype=np.float64)
        if indices.shape != values.shape:
            raise RuntimeError("Canonical objective arrays do not align.")
        raw_contribution = float(np.dot(values, decisions[indices]))
        resolved_coefficient = float(raw_objective["resolved_coefficient"])
        normalized_contribution = resolved_coefficient * raw_contribution
        conservation_benefit += normalized_contribution
        objective_components.append(
            {
                **raw_objective,
            "raw_selected_contribution": raw_contribution,
            "weighted_normalized_contribution": normalized_contribution,
            }
        )

    neighbor_value = None
    neighbor_contribution = None
    neighbor_request = snapshot.get("neighbor_penalty")
    structure_path = preparation_directory / "planning-structure.json"
    if neighbor_request is not None:
        if not isinstance(neighbor_request, dict) or not structure_path.exists():
            raise RuntimeError("Neighbor reconstruction metadata is incomplete.")
        structure = load_neighbor_structure(
            json.loads(structure_path.read_text(encoding="utf-8"))
        )
        neighbor_value = raw_neighbor_value(
            structure,
            decisions,
            str(snapshot.get("decision_domain", "discrete")),
        )
        neighbor_provenance = artifact.manifest.provenance.get("neighbor_penalty")
        if not isinstance(neighbor_provenance, dict):
            raise RuntimeError("Compiled neighbor normalization is incomplete.")
        neighbor_contribution = float(
            float(neighbor_provenance["resolved_coefficient"]) * neighbor_value
        )
    scientific_objective = conservation_benefit + (neighbor_contribution or 0.0)
    if result.objective_value is not None and not np.isclose(
        scientific_objective,
        result.objective_value,
        rtol=1e-7,
        atol=1e-7,
    ):
        raise RuntimeError(
            "Reconstructed scientific objective differs from the solver objective."
        )
    return replace(
        result,
        decisions=decisions,
        raw_conservation_benefit=conservation_benefit,
        raw_neighbor_value=neighbor_value,
        neighbor_penalty_contribution=neighbor_contribution,
        diagnostics={
            **(result.diagnostics or {}),
            "objective_components": objective_components,
        },
    )


def compile_optimization_run(
    task_run_id: str,
    run: Dict[str, Any],
    output_directory: str,
) -> CompiledRunPreparation:
    """Compile and upload one model while the Dask child flow is alive.

    Returning from the child flow closes its local Dask cluster before the
    parent flow loads the compiled artifact into HiGHS.
    """
    logger = get_run_logger()
    snapshot = run["input_snapshot"]
    source = snapshot["analytical_source"]
    task_id = snapshot["task"]["task_id"]
    output_dir = Path(output_directory)
    parameters = build_parameters(run)
    preparation_dir = output_dir / "prepared"
    inventory_path = output_dir / "planning-unit-inventory.json"
    grid_context_path = output_dir / "planning-grid-context.json"
    active_artifacts: list[str] = []
    try:
        grid_context_future = initialize_planning_grid.submit(
            parameters,
            str(grid_context_path),
        )
        grid_context_future.result()
        grid_context = json.loads(grid_context_path.read_text(encoding="utf-8"))
        tile_records = [
            tile.to_dict()
            for tile in iter_grid_tiles(
                int(grid_context["height"]),
                int(grid_context["width"]),
                int(grid_context["tile_size"]),
            )
        ]
        ready_inventory = next(
            (
                artifact
                for artifact in run.get("artifacts", [])
                if artifact.get("type") == "planning_unit_inventory"
                and artifact.get("status") == "ready"
                and artifact.get("uri")
                and artifact.get("lineage", {}).get("input_hash") == run["input_hash"]
            ),
            None,
        )
        if ready_inventory is not None:
            bucket, key = parse_uri(str(ready_inventory["uri"]))
            download_object(
                bucket=bucket,
                key=key,
                local_path=str(inventory_path),
            )
            inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
            logger.info(
                "Reused finalized planning-unit inventory for restarted run: %s",
                task_run_id,
            )
        else:
            active_artifacts = ["planning_unit_inventory"]
            update_artifact(task_run_id, "planning_unit_inventory", status="building")
            tile_count_dir = output_dir / "tile-counts"
            _submit_in_bounded_waves(
                tile_records,
                lambda record: count_planning_tile.submit(
                    parameters,
                    source["uri"],
                    str(grid_context_path),
                    record,
                    str(tile_count_dir),
                ),
            )
            inventory_future = finalize_planning_inventory.submit(
                task_id,
                str(grid_context_path),
                str(tile_count_dir),
                str(inventory_path),
                parameters.neighbor_penalty is not None,
            )
            inventory_future.result()
            inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
            inventory_metadata = _upload_finalized_artifact(
                task_run_id,
                "planning_unit_inventory",
                inventory_path,
                "application/json",
            )
            update_artifact(
                task_run_id, "planning_unit_inventory", **inventory_metadata
            )
            active_artifacts = []
            enforce_scratch_limit(output_dir, "planning inventory finalization")

        planning_unit_count = int(inventory["planning_unit_count"])
        update_run(
            task_run_id,
            stage="admitting",
            planning_unit_count=planning_unit_count,
        )
        first_admission = evaluate_count_admission(
            planning_unit_count,
            parameters.resolution,
        )
        update_run(
            task_run_id,
            admission_outcome={"reference": first_admission},
        )
        if not first_admission["admitted"]:
            raise RuntimeError(
                "Structural inventory was rejected by the configured execution "
                f"profile: {first_admission['reason_code']}."
            )

        update_run(task_run_id, stage="preparing")
        canonical_path = output_dir / "canonical-result.zarr"
        _submit_in_bounded_waves(
            inventory["tiles"],
            lambda record: prepare_planning_tile.submit(
                parameters,
                source["uri"],
                str(grid_context_path),
                record,
                str(preparation_dir),
            ),
        )
        preparation_future = finalize_spatial_preparation.submit(
            task_id,
            parameters,
            str(grid_context_path),
            str(preparation_dir),
            str(inventory_path),
        )
        preparation_manifest_path = preparation_future.result()
        enforce_scratch_limit(output_dir, "spatial preparation")
        update_run(task_run_id, stage="compiling")
        active_artifacts = ["compiled_model"]
        update_artifact(task_run_id, "compiled_model", status="building")
        compilation = compile_prepared_artifact(
            parameters,
            str(preparation_dir),
            run["input_hash"],
        )
        preparation_manifest = json.loads(
            Path(preparation_manifest_path).read_text(encoding="utf-8")
        )
        feature_nonzero_count = int(preparation_manifest["feature_nonzero_count"])
        reduction = preparation_manifest["reduction"]
        update_run(
            task_run_id,
            stage="admitting",
            feature_nonzero_count=feature_nonzero_count,
            neighbor_edge_count=int(
                preparation_manifest.get("raw_neighbor_edge_count", 0)
            ),
        )
        compiled_model = compilation.model
        neighbor_metadata = compilation.reconstruction.neighbor
        model_dimensions = {
            "neighbor_edge_count": (
                neighbor_metadata.pairwise_neighbor_edge_count
                if neighbor_metadata is not None
                else 0
            ),
            "constraint_row_count": compiled_model.constraint_count,
            "matrix_nonzero_count": compiled_model.nonzero_count,
            "auxiliary_variable_count": (
                compiled_model.variable_count - compiled_model.primary_variable_count
            ),
            "primary_variable_count": compiled_model.primary_variable_count,
        }
        second_admission = evaluate_sparse_admission(
            planning_unit_count,
            int(reduction["retained_relationship_nonzeros"]),
            model_dimensions["neighbor_edge_count"],
            model_dimensions["constraint_row_count"],
            model_dimensions["matrix_nonzero_count"],
            model_dimensions["auxiliary_variable_count"],
            model_dimensions["primary_variable_count"],
        )
        second_admission["reduction"] = reduction
        update_run(
            task_run_id,
            admission_outcome={"reference": second_admission},
        )
        if not second_admission["admitted"]:
            raise RuntimeError(
                "Compiled sparse model was rejected by execution profile "
                f"'{second_admission['profile']['name']}': "
                f"{second_admission['reason_code']}; measured dimensions="
                f"{second_admission['measured']}, footprint="
                f"{second_admission['footprint']}, capacity="
                f"{second_admission['profile']}."
            )
        enforce_scratch_limit(output_dir, "compiled model creation")
        compiled_metadata = _upload_compiled_artifact(
            task_run_id, preparation_dir / "compiled-model"
        )
        update_artifact(task_run_id, "compiled_model", **compiled_metadata)
        active_artifacts = []
        return CompiledRunPreparation(
            preparation_directory=str(preparation_dir),
            preparation_manifest=preparation_manifest,
            canonical_path=str(canonical_path),
        )
    except Exception as error:
        for artifact_type in active_artifacts:
            try:
                update_artifact(
                    task_run_id,
                    artifact_type,
                    status="failed",
                    failure_code="stage_failed",
                    failure_message=str(error),
                )
            except Exception as artifact_error:
                logger.error(
                    "Failed to persist %s artifact failure: %s",
                    artifact_type,
                    artifact_error,
                )
        raise


def execute_optimization_run(
    task_run_id: str,
    *,
    expected_task_type: str,
    expected_execution_method: str,
    decision_domain: DecisionDomain,
    compile_run: Callable[
        [str, Dict[str, Any], str], CompiledRunPreparation
    ] = compile_optimization_run,
) -> None:
    """Execute the canonical compile, HiGHS, reconstruct, and publish flow."""
    logger = get_run_logger()
    run = resolve_run(task_run_id)
    if run["task_type"] != expected_task_type:
        raise ValueError(
            f"This flow only accepts {expected_task_type} runs."
        )
    snapshot = run["input_snapshot"]
    output_dir = task_run_scratch_directory(task_run_id, str(flow_run.id))
    output_dir.mkdir(parents=True, exist_ok=True)

    execution_method = run["execution_method"]
    if execution_method != expected_execution_method:
        raise ValueError(
            f"Optimization execution cannot use method {execution_method}."
        )
    update_run(task_run_id, status="running", stage="counting")
    active_artifacts: list[str] = []
    try:
        prepared = compile_run(task_run_id, run, str(output_dir))
        preparation_dir = Path(prepared.preparation_directory)
        preparation_manifest = prepared.preparation_manifest
        canonical_path = Path(prepared.canonical_path)
        grid_definition = run["planning_unit_definition"]
        logger.info("Dask compilation flow closed; starting HiGHS.")
        active_artifacts = ["raw_solver_result"]
        update_artifact(task_run_id, "raw_solver_result", status="building")
        update_run(task_run_id, stage="solving")
        solver_status = _solve_compiled_model(
            task_run_id,
            snapshot,
            preparation_manifest,
            preparation_dir,
            output_dir,
            canonical_path,
            grid_definition,
            decision_domain,
        )
        active_artifacts.remove("raw_solver_result")
        active_artifacts.append("canonical_result")
        update_artifact(task_run_id, "canonical_result", status="building")
        canonical_metadata = _upload_zarr_artifact(task_run_id, canonical_path)
        update_artifact(task_run_id, "canonical_result", **canonical_metadata)
        active_artifacts.remove("canonical_result")
        if decision_domain == "discrete" and snapshot.get("export_selected_parquet"):
            active_artifacts = ["canonical_export"]
            update_run(task_run_id, stage="exporting")
            update_artifact(task_run_id, "canonical_export", status="building")
            export_path = export_selected_parquet(
                canonical_path, output_dir / "selected-planning-units.parquet"
            )
            export_metadata = _upload_finalized_artifact(
                task_run_id,
                "canonical_export",
                export_path,
                "application/vnd.apache.parquet",
            )
            update_artifact(task_run_id, "canonical_export", **export_metadata)
            active_artifacts = []
        update_run(task_run_id, stage="publishing", solver_status=solver_status)
        active_artifacts = ["pmtiles"]
        internal_api_request("POST", f"/internal/run/{task_run_id}/publish")
        logger.info(
            "Optimization run solved; task-tile publication dispatched: %s",
            task_run_id,
        )
    except Exception as error:
        logger.error("Task run failed: %s", error)
        for artifact_type in active_artifacts:
            try:
                update_artifact(
                    task_run_id,
                    artifact_type,
                    status="failed",
                    failure_code="stage_failed",
                    failure_message=str(error),
                )
            except Exception as artifact_error:
                logger.error(
                    "Failed to persist %s artifact failure: %s",
                    artifact_type,
                    artifact_error,
                )
        update_run(
            task_run_id,
            status="failed",
            failure_code=getattr(error, "failure_code", "task_run_failed"),
            failure_message=str(error),
        )
        raise
    finally:
        cleanup_scratch_directory(output_dir)


@task(name="solve_priority_ranking_model")
def _solve_priority_ranking_model(
    task_run_id: str,
    snapshot: Dict[str, Any],
    preparation_manifest: Dict[str, Any],
    preparation_dir: Path,
    output_dir: Path,
    canonical_path: Path,
    grid_definition: Dict[str, Any],
) -> str:
    """Solve nested continuous allocation increments and materialize priority."""
    logger = get_run_logger()
    work_budget = snapshot.get("work_budget", {})
    time_limit = float(
        work_budget.get(
            "wall_time_seconds", os.getenv("HIGHS_TIME_LIMIT_SECONDS", "86400")
        )
    )
    target_gap = float(work_budget.get("relative_gap", 0.15))
    artifact = load_compiled_artifact(preparation_dir / "compiled-model")
    if artifact.manifest.fixed_in_count or artifact.manifest.fixed_out_count:
        raise RuntimeError(
            "Priority ranking requires every eligible planning unit to remain "
            "variable after compilation."
        )
    configuration = SolveConfiguration(
        time_limit_seconds=time_limit,
        relative_mip_gap=target_gap,
        thread_count=(
            int(work_budget["thread_count"])
            if work_budget.get("thread_count") is not None
            else None
        ),
        random_seed=int(work_budget.get("random_seed", 0)),
        mode=(
            "exact_audit"
            if snapshot.get("optimization_mode") == "exact_audit"
            else "standard"
        ),
    )
    last_progress_update = 0.0

    def report_progress(progress: dict[str, object]) -> None:
        nonlocal last_progress_update
        current = time.monotonic()
        if (
            progress.get("phase") != "increment_complete"
            and current - last_progress_update < 5.0
        ):
            return
        last_progress_update = current
        logger.info(
            "Priority ranking HiGHS %s: increment=%s budget=%s elapsed=%.1fs memory=%s",
            progress.get("phase", "solving"),
            progress.get("increment"),
            progress.get("budget_fraction"),
            float(progress.get("elapsed_seconds", 0.0)),
            progress.get("memory"),
        )
        update_run(task_run_id, stage="solving", progress=progress)

    with acquire_task_run_slot():
        ranking = solve_priority_ranking(
            artifact.model,
            configuration=configuration,
            work_directory=output_dir / "priority-increments",
            budget_fractions=PRIORITY_BUDGET_FRACTIONS,
            progress_callback=report_progress,
        )
    final_source = _reconstruct_source_decisions(
        ranking.final_result,
        artifact,
        int(preparation_manifest["planning_unit_count"]),
        output_dir / "decision-vectors" / "priority-final.npy",
    )
    priority_source = _reconstruct_source_values(
        ranking.priority,
        artifact,
        int(preparation_manifest["planning_unit_count"]),
        output_dir / "decision-vectors" / "priority-score.npy",
    )
    final_scientific = _reconstruct_scientific_result(
        ranking.final_result,
        final_source,
        artifact,
        preparation_dir,
        snapshot,
    )
    planning_paths = sorted((preparation_dir / "planning-units").glob("*.parquet"))
    raw_path = output_dir / "priority-ranking-result.json"
    raw_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "surface": "priority",
                "score": "mean_nested_allocation_v1",
                "budget_fractions": list(ranking.budget_fractions),
                "diagnostics": list(ranking.diagnostics),
                "solver_status": ranking.final_result.status,
                "objective_value": final_scientific.objective_value,
                "runtime_seconds": ranking.runtime_seconds,
                "priority_path": ranking.priority_path,
                "increment_paths": list(ranking.increment_paths),
            },
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    write_solver_canonical_zarr(
        canonical_path,
        planning_paths,
        priority_source,
        height=int(preparation_manifest["height"]),
        width=int(preparation_manifest["width"]),
        chunk_size=int(preparation_manifest["tile_size"]),
        transform=preparation_manifest["transform"],
        crs=preparation_manifest["crs"],
        planning_unit_resolution=int(preparation_manifest["resolution"]),
        grid_family_id=grid_definition["grid_family_id"],
        grid_level=int(grid_definition["grid_level"]),
        full_grid_width=int(preparation_manifest["full_grid_width"]),
        global_row_offset=int(preparation_manifest["global_row_offset"]),
        global_col_offset=int(preparation_manifest["global_col_offset"]),
        surface="priority",
    )
    raw_metadata = _upload_finalized_artifact(
        task_run_id, "raw_solver_result", raw_path, "application/json"
    )
    update_artifact(task_run_id, "raw_solver_result", **raw_metadata)
    cleanup_scratch_directory(preparation_dir)
    cleanup_scratch_directory(output_dir / "decision-vectors")
    cleanup_scratch_directory(output_dir / "priority-increments")
    enforce_scratch_limit(output_dir, "priority materialization")
    update_solution(
        task_run_id,
        solution_index=0,
        role="reference",
        status=ranking.final_result.status,
        objective_value=final_scientific.objective_value,
        resource_value=float(np.sum(final_scientific.decisions)),
        selected_planning_unit_count=None,
        optimality_gap=ranking.final_result.optimality_gap,
        solver_name=ranking.final_result.solver_name,
        solver_version=ranking.final_result.solver_version,
        runtime_seconds=ranking.runtime_seconds,
        metrics={
            "task_type": "priority_ranking",
            "decision_domain": "continuous",
            "score": "mean_nested_allocation_v1",
            "budget_fractions": list(ranking.budget_fractions),
            "allocation_targets": [
                float(value * artifact.model.primary_variable_count)
                for value in ranking.budget_fractions
            ],
            "priority_total": ranking.allocation_total,
            "final_allocation_total": float(np.sum(final_scientific.decisions)),
            "increment_diagnostics": list(ranking.diagnostics),
            "best_bound": ranking.final_result.best_bound,
            "termination_reason": ranking.final_result.termination_reason,
            "raw_conservation_benefit": final_scientific.raw_conservation_benefit,
            "raw_neighbor_value": final_scientific.raw_neighbor_value,
            "neighbor_penalty_contribution": (
                final_scientific.neighbor_penalty_contribution
            ),
            "objective_components": (
                final_scientific.diagnostics or {}
            ).get("objective_components", []),
            "neighbor_normalization": artifact.manifest.provenance.get(
                "neighbor_penalty"
            ),
            "objective_offset": artifact.model.objective_offset,
            "solver_settings": ranking.final_result.solver_settings,
            "solver_memory_profile": ranking.final_result.memory_profile,
        },
    )
    update_run(
        task_run_id,
        stage="materializing",
        solver_name=ranking.final_result.solver_name,
        solver_version=ranking.final_result.solver_version,
        solver_status=ranking.final_result.status,
        objective_value=final_scientific.objective_value,
        optimality_gap=ranking.final_result.optimality_gap,
        runtime_seconds=ranking.runtime_seconds,
    )
    return ranking.final_result.status


def _priority_solver_options() -> dict[str, int | float | str | bool]:
    """Return HiGHS options tuned for large continuous priority-ranking LPs."""
    options: dict[str, int | float | str | bool] = {
        "solver": os.getenv("PRIORITY_HIGHS_SOLVER", "ipm"),
        "run_crossover": os.getenv("PRIORITY_HIGHS_RUN_CROSSOVER", "on"),
        "presolve": os.getenv("PRIORITY_HIGHS_PRESOLVE", "on"),
    }
    if os.getenv("PRIORITY_HIGHS_IPM_TOLERANCE"):
        options["ipm_optimality_tolerance"] = float(
            os.environ["PRIORITY_HIGHS_IPM_TOLERANCE"]
        )
    if os.getenv("PRIORITY_HIGHS_PDLP_TOLERANCE"):
        options["pdlp_optimality_tolerance"] = float(
            os.environ["PRIORITY_HIGHS_PDLP_TOLERANCE"]
        )
    return options


def _reconstruct_source_values(
    values: np.ndarray,
    artifact: Any,
    planning_unit_count: int,
    output_path: Path,
) -> np.ndarray:
    """Restore compact primary-column values into source planning-unit order."""
    candidate_sources = np.asarray(artifact.candidate_source_indices, dtype=np.int64)
    fixed_sources = np.asarray(artifact.fixed_source_indices, dtype=np.int64)
    fixed_values = np.asarray(artifact.fixed_values, dtype=np.float64)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    reconstructed = np.lib.format.open_memmap(
        output_path,
        mode="w+",
        dtype=np.float64,
        shape=(planning_unit_count,),
    )
    if len(candidate_sources) + len(fixed_sources) != planning_unit_count:
        raise RuntimeError("Artifact reconstruction did not cover every planning unit.")
    source_values = np.asarray(values)
    batch_size = 1_048_576
    for start in range(0, len(candidate_sources), batch_size):
        stop = min(start + batch_size, len(candidate_sources))
        reconstructed[candidate_sources[start:stop]] = np.asarray(
            source_values[start:stop],
            dtype=np.float32,
        )
    for start in range(0, len(fixed_sources), batch_size):
        stop = min(start + batch_size, len(fixed_sources))
        reconstructed[fixed_sources[start:stop]] = fixed_values[start:stop]
    reconstructed.flush()
    return reconstructed


def execute_priority_ranking_run(
    task_run_id: str,
    *,
    compile_run: Callable[
        [str, Dict[str, Any], str], CompiledRunPreparation
    ] = compile_optimization_run,
) -> None:
    """Execute the priority ranking compile, nested LP solve, and publication flow."""
    logger = get_run_logger()
    run = resolve_run(task_run_id)
    if run["task_type"] != "priority_ranking":
        raise ValueError("This flow only accepts priority_ranking runs.")
    if run["execution_method"] != "compiled_priority_ranking":
        raise ValueError(
            f"Priority ranking cannot use method {run['execution_method']}."
        )
    output_dir = task_run_scratch_directory(task_run_id, str(flow_run.id))
    output_dir.mkdir(parents=True, exist_ok=True)
    update_run(task_run_id, status="running", stage="counting")
    active_artifacts: list[str] = []
    try:
        prepared = compile_run(task_run_id, run, str(output_dir))
        preparation_dir = Path(prepared.preparation_directory)
        preparation_manifest = prepared.preparation_manifest
        canonical_path = Path(prepared.canonical_path)
        active_artifacts = ["raw_solver_result"]
        update_artifact(task_run_id, "raw_solver_result", status="building")
        update_run(task_run_id, stage="solving")
        solver_status = _solve_priority_ranking_model(
            task_run_id,
            run["input_snapshot"],
            preparation_manifest,
            preparation_dir,
            output_dir,
            canonical_path,
            run["planning_unit_definition"],
        )
        active_artifacts.remove("raw_solver_result")
        active_artifacts.append("canonical_result")
        update_artifact(task_run_id, "canonical_result", status="building")
        canonical_metadata = _upload_zarr_artifact(task_run_id, canonical_path)
        update_artifact(task_run_id, "canonical_result", **canonical_metadata)
        active_artifacts.remove("canonical_result")
        update_run(task_run_id, stage="publishing", solver_status=solver_status)
        active_artifacts = ["pmtiles"]
        internal_api_request("POST", f"/internal/run/{task_run_id}/publish")
        logger.info(
            "Priority ranking run solved; task-tile publication dispatched: %s",
            task_run_id,
        )
    except Exception as error:
        logger.error("Priority ranking run failed: %s", error)
        for artifact_type in active_artifacts:
            try:
                update_artifact(
                    task_run_id,
                    artifact_type,
                    status="failed",
                    failure_code="stage_failed",
                    failure_message=str(error),
                )
            except Exception as artifact_error:
                logger.error(
                    "Failed to persist %s artifact failure: %s",
                    artifact_type,
                    artifact_error,
                )
        update_run(
            task_run_id,
            status="failed",
            failure_code=getattr(error, "failure_code", "task_run_failed"),
            failure_message=str(error),
        )
        raise
    finally:
        cleanup_scratch_directory(output_dir)
