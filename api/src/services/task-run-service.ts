import { IDBConnection } from '../database/db';
import { ApiGeneralError } from '../errors/api-error';
import { ArtifactType, UpdateArtifact } from '../models/artifact';
import { SubmitTaskRequest } from '../models/task-orchestrator';
import { TaskRun, TaskRunExecutionMethod, UpdateTaskRun } from '../models/task-run';
import { UpsertTaskRunSolution } from '../models/task-run-solution';
import { TaskRunWithArtifacts } from '../models/task-run.interface';
import { AnalyticalSourceRepository } from '../repositories/analytical-source-repository';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { TaskRunSolutionRepository } from '../repositories/task-run-solution-repository';
import { hashCanonicalJson } from '../utils/canonical-json';
import { estimateGeoJsonAreaSquareMetres } from '../utils/geojson-area';
import { resolveLayerContract } from '../utils/layer-contract';
import { classifyLayerMapping } from '../utils/layer-mapping';
import { createPlanningGridDefinition, DEFAULT_PLANNING_UNIT_RESOLUTION } from '../utils/planning-grid';
import { toPresignedPmtilesUrl } from '../utils/pmtiles';
import { getIncompletePublicationArtifacts } from '../utils/publication';
import { DBService } from './db-service';
import { PrefectService } from './prefect-service';
import { TaskService } from './task-service';

/** Coordinates immutable run snapshots and recoverable workflow dispatch. */
export class TaskRunService extends DBService {
  private taskService: TaskService;
  private taskRunRepository: TaskRunRepository;
  private artifactRepository: ArtifactRepository;
  private sourceRepository: AnalyticalSourceRepository;
  private solutionRepository: TaskRunSolutionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.taskService = new TaskService(connection);
    this.taskRunRepository = new TaskRunRepository(connection);
    this.artifactRepository = new ArtifactRepository(connection);
    this.sourceRepository = new AnalyticalSourceRepository(connection);
    this.solutionRepository = new TaskRunSolutionRepository(connection);
  }

  /**
   * Creates and persists an immutable queued run without contacting Prefect.
   *
   * @param {string} taskId Owning task.
   * @param {SubmitTaskRequest} request Submitted configuration overrides.
   * @returns {Promise<TaskRunWithArtifacts>}
   */
  async createQueuedRun(taskId: string, request: SubmitTaskRequest): Promise<TaskRunWithArtifacts> {
    const task = await this.taskService.getTaskById(taskId);
    const optimizationMode = request.optimization_mode ?? 'interactive';

    const source = await this.sourceRepository.getDefaultSource();
    if (!source) {
      throw new ApiGeneralError('No default published analytical source is configured.', []);
    }
    const configuredSourceUri = process.env.ZARR_STORE_PATH;
    const resolvedSource =
      source.version === 'legacy_unversioned' && configuredSourceUri
        ? {
            ...source,
            uri: configuredSourceUri,
            version: process.env.ANALYTICAL_SOURCE_VERSION ?? source.version,
            checksum: process.env.ANALYTICAL_SOURCE_CHECKSUM ?? source.checksum
          }
        : source;

    const taskType = task.type;
    const decisionDomain =
      taskType === 'continuous_optimization' || taskType === 'priority_ranking' ? 'continuous' : 'discrete';

    if (!request.objectives.length) {
      throw new ApiGeneralError('An optimization requires at least one objective.', []);
    }
    const objectives = request.objectives.map((objective) => ({
      ...objective,
      importance: objective.importance ?? 1
    }));
    if (new Set(objectives.map((objective) => objective.layer)).size !== objectives.length) {
      throw new ApiGeneralError('Each layer may appear at most once in objectives.', []);
    }
    if (objectives.some((objective) => !Number.isFinite(objective.importance) || objective.importance < 0)) {
      throw new ApiGeneralError('Objective importance must be a finite nonnegative number.', []);
    }
    if (request.constraints.some((constraint) => constraint.min == null && constraint.max == null)) {
      throw new ApiGeneralError('Every optimization constraint requires a minimum or maximum.', []);
    }
    if (
      request.constraints.some(
        (constraint) => constraint.min != null && constraint.max != null && constraint.min > constraint.max
      )
    ) {
      throw new ApiGeneralError('Constraint minimum cannot exceed its maximum.', []);
    }

    const planningUnitResolution =
      request.planning_unit_resolution ?? request.resolution ?? task.resolution ?? DEFAULT_PLANNING_UNIT_RESOLUTION;
    const resampling = request.resampling ?? task.resampling ?? 'mode';
    const targetArea = request.target_area;
    const legacyAggregationMethod = resampling === 'min' ? 'minimum' : resampling === 'max' ? 'maximum' : 'mode';
    const allowLegacyCoarseToFine =
      process.env.ALLOW_LEGACY_COARSE_TO_FINE === 'true' || process.env.NODE_ENV === 'development';
    const layerIds = Array.from(
      new Set([
        ...objectives.map((objective) => objective.layer),
        ...request.constraints.map((constraint) => constraint.layer)
      ])
    );
    const layerContracts = layerIds.map((layerId) =>
      resolveLayerContract(layerId, resolvedSource.schema_metadata, legacyAggregationMethod, allowLegacyCoarseToFine)
    );
    const planningUnitDefinition = createPlanningGridDefinition(
      planningUnitResolution,
      hashCanonicalJson(targetArea),
      resolvedSource.schema_metadata.grid_extent ?? null,
      resolvedSource.schema_metadata.grid_shape ?? null,
      {
        analytical_source_id: resolvedSource.analytical_source_id,
        analytical_source_version: resolvedSource.version,
        complete: Boolean(resolvedSource.schema_metadata.grid_extent && resolvedSource.schema_metadata.grid_shape)
      }
    );
    const layerMappings = layerContracts.map((contract) =>
      classifyLayerMapping(
        contract,
        planningUnitResolution,
        planningUnitDefinition.transform,
        planningUnitDefinition.crs
      )
    );
    const unsupportedMapping = layerMappings.find((mapping) => mapping.method === 'unsupported');
    if (unsupportedMapping) {
      throw new ApiGeneralError(
        `Layer "${unsupportedMapping.layer_id}" has native evidence resolution ` +
          `${unsupportedMapping.native_resolution.toLocaleString()} m. The requested planning-unit resolution is ` +
          `${planningUnitResolution.toLocaleString()} m. This layer does not declare a supported coarse-to-fine mapping policy.`,
        []
      );
    }
    const neighborPenalty = this.resolveNeighborPenalty(request.neighbor_penalty);
    const executionMethod: TaskRunExecutionMethod =
      taskType === 'priority_ranking'
        ? 'compiled_priority_ranking'
        : decisionDomain === 'continuous'
          ? 'compiled_continuous_optimization'
          : 'compiled_discrete_optimization';
    const evidenceResolutions = layerContracts.map((contract) => contract.evidence_resolution);
    const snapshot: Record<string, unknown> = {
      schema_version: 9,
      task_type: taskType,
      optimization_mode: optimizationMode,
      work_budget: this.resolveWorkBudget(optimizationMode),
      execution_method: executionMethod,
      layer_mapping_classification: Object.fromEntries(layerMappings.map((mapping) => [mapping.layer_id, mapping])),
      decision_type: decisionDomain === 'continuous' ? 'continuous' : 'binary',
      decision_domain: decisionDomain,
      preserve_primary_domain: taskType === 'priority_ranking',
      allocation_target_row: taskType === 'priority_ranking',
      priority_budget_fractions:
        taskType === 'priority_ranking' ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] : undefined,
      task: { task_id: taskId, type: taskType, name: task.name, description: task.description },
      target_area: targetArea,
      objectives,
      constraints: request.constraints,
      layer_contracts: Object.fromEntries(layerContracts.map((contract) => [contract.layer_id, contract])),
      resampling,
      evidence_resolution: {
        minimum: Math.min(...evidenceResolutions),
        maximum: Math.max(...evidenceResolutions),
        by_layer: Object.fromEntries(
          layerContracts.map((contract) => [contract.layer_id, contract.evidence_resolution])
        )
      },
      planning_unit_resolution: planningUnitResolution,
      grid_family_id: 'bc_albers_30m_v1',
      neighbor_penalty: neighborPenalty,
      export_selected_parquet: decisionDomain === 'discrete' ? request.export_selected_parquet ?? false : false,
      analytical_source: {
        analytical_source_id: resolvedSource.analytical_source_id,
        name: resolvedSource.name,
        version: resolvedSource.version,
        uri: resolvedSource.uri,
        checksum: resolvedSource.checksum,
        format: resolvedSource.format
      }
    };
    const estimatedAoiArea =
      estimateGeoJsonAreaSquareMetres([targetArea]) ??
      this.estimateGridExtentArea(resolvedSource.schema_metadata.grid_extent);
    const estimatedPlanningUnits =
      estimatedAoiArea === null ? null : Math.ceil(estimatedAoiArea / planningUnitResolution ** 2);
    const preliminaryEstimate = {
      schema_version: 1,
      authoritative: false,
      planning_unit_resolution: planningUnitResolution,
      method: estimatedAoiArea === null ? 'published_grid_extent' : 'conservative_spherical_geojson_area',
      estimated_aoi_area_square_metres: estimatedAoiArea,
      estimated_planning_units: estimatedPlanningUnits,
      estimated_source_cells_read:
        estimatedPlanningUnits === null
          ? null
          : Math.ceil(
              estimatedPlanningUnits *
                layerContracts.reduce(
                  (total, contract) => total + Math.max(1, (planningUnitResolution / contract.native_resolution) ** 2),
                  0
                )
            ),
      estimated_uncompressed_input_bytes:
        estimatedPlanningUnits === null
          ? null
          : Math.ceil(
              estimatedPlanningUnits *
                layerContracts.reduce(
                  (total, contract) => total + Math.max(1, (planningUnitResolution / contract.native_resolution) ** 2),
                  0
                ) *
                4
            ),
      reason: 'AOI overlap, exclusions, nodata, and source validity are resolved by the authoritative tiled count.'
    };

    const run = await this.taskRunRepository.createTaskRun({
      task_id: taskId,
      task_type: taskType,
      analytical_source_id: source.analytical_source_id,
      execution_method: executionMethod,
      execution_method_version: this.getExecutionMethodVersion(executionMethod),
      input_snapshot: snapshot,
      input_hash: hashCanonicalJson({ snapshot, planning_unit_definition: planningUnitDefinition }),
      planning_unit_definition: planningUnitDefinition,
      solver_config: this.getExecutionConfiguration(optimizationMode),
      code_version: process.env.APP_VERSION ?? process.env.GIT_SHA ?? null
    });

    await this.taskRunRepository.updateTaskRun(run.task_run_id, { preliminary_estimate: preliminaryEstimate });

    const artifactTypes = this.getArtifactTypes(
      decisionDomain === 'discrete' && (request.export_selected_parquet ?? false)
    );
    for (const type of artifactTypes) {
      const preparationInputs = {
        analytical_source: snapshot.analytical_source,
        target_area: targetArea,
        planning_unit_definition: planningUnitDefinition,
        resampling
      };
      const cacheInputs =
        type === 'planning_unit_inventory'
          ? preparationInputs
          : { input_hash: run.input_hash, code_version: run.code_version, artifact_type: type };
      await this.artifactRepository.createArtifact({
        task_run_id: run.task_run_id,
        type,
        cache_key: hashCanonicalJson(cacheInputs),
        lineage: { input_hash: run.input_hash }
      });
    }

    return this.getTaskRunById(run.task_run_id);
  }

  /**
   * Dispatches an already committed queued run to Prefect.
   *
   * @param {string} taskRunId Run to dispatch.
   * @returns {Promise<TaskRun>}
   */
  async dispatchRun(taskRunId: string): Promise<TaskRun> {
    const run = await this.taskRunRepository.getTaskRunForDispatch(taskRunId);
    if (run.status === 'queued' && run.prefect_flow_run_id) {
      return run;
    }
    if (run.status !== 'queued' && run.status !== 'failed') {
      throw new ApiGeneralError('Only queued or recoverable failed runs can be dispatched.', []);
    }

    await this.taskRunRepository.recordDispatchAttempt(taskRunId);
    try {
      const { deploymentId, flowRunId } = await new PrefectService().submitTaskRun(
        taskRunId,
        run.task_type,
        run.execution_method,
        run.dispatch_attempts + 1
      );
      await this.taskService.updateTaskExecution(run.task_id, {
        status: 'submitted',
        status_message: null,
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
      return this.taskRunRepository.updateTaskRun(taskRunId, {
        prefect_flow_run_id: flowRunId,
        prefect_deployment_id: deploymentId
      });
    } catch (error) {
      await this.taskRunRepository.updateTaskRun(taskRunId, {
        failure_code: 'dispatch_failed',
        failure_message: error instanceof Error ? error.message : 'Failed to dispatch run.'
      });
      await this.taskService.updateTaskExecution(run.task_id, {
        status: 'failed_to_submit',
        status_message: error instanceof Error ? error.message : 'Failed to dispatch run.'
      });
      throw error;
    }
  }

  /** Persists publication state before any external Prefect submission. */
  async preparePublication(taskRunId: string): Promise<TaskRun> {
    const run = await this.taskRunRepository.getTaskRunById(taskRunId);
    const artifacts = await this.artifactRepository.getArtifactsByRunId(taskRunId);
    const hasReadyCanonical = artifacts.some(
      (artifact) => artifact.type === 'canonical_result' && artifact.status === 'ready'
    );
    const pmtiles = artifacts.find((artifact) => artifact.type === 'pmtiles');
    const incomplete = getIncompletePublicationArtifacts(artifacts);
    if (
      run.status === 'running' &&
      run.stage === 'publishing' &&
      incomplete.some((artifact) => artifact.status === 'building')
    ) {
      return run;
    }
    if (!['running', 'failed'].includes(run.status) || !hasReadyCanonical || !pmtiles || incomplete.length === 0) {
      throw new ApiGeneralError('This run is not eligible for canonical-result publication.', []);
    }
    for (const artifact of incomplete) {
      await this.artifactRepository.updateArtifact(artifact.artifact_id, { status: 'building' });
    }
    await this.taskRunRepository.updateTaskRun(taskRunId, {
      status: 'running',
      stage: 'publishing'
    });
    return this.taskRunRepository.getTaskRunById(taskRunId);
  }

  /** Dispatches a previously persisted publishing run to task-tile. */
  async dispatchPreparedPublication(taskRunId: string, publicationRevision: number): Promise<void> {
    await new PrefectService().submitTaskRunTile(taskRunId, publicationRevision);
  }

  /** Compatibility helper for callers already managing their own transaction. */
  async dispatchPublication(taskRunId: string): Promise<TaskRun> {
    const run = await this.preparePublication(taskRunId);
    await this.dispatchPreparedPublication(taskRunId, run.revision);
    return run;
  }

  /** Retries only PMTiles publication without repeating optimization. */
  async retryPublication(taskRunId: string): Promise<TaskRun> {
    return this.preparePublication(taskRunId);
  }

  /** Persists a task-tile dispatch or execution failure without changing solver metadata. */
  async failPublication(taskRunId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'Task-run publication failed.';
    const artifacts = await this.artifactRepository.getArtifactsByRunId(taskRunId);
    for (const artifact of getIncompletePublicationArtifacts(artifacts)) {
      await this.artifactRepository.updateArtifact(artifact.artifact_id, {
        status: 'failed',
        failure_code: 'publication_failed',
        failure_message: message
      });
    }
    await this.updateRun(taskRunId, {
      status: 'failed',
      failure_code: 'publication_failed',
      failure_message: message
    });
  }

  /** Returns one run with artifacts. */
  async getTaskRunById(taskRunId: string): Promise<TaskRunWithArtifacts> {
    const run = await this.taskRunRepository.getTaskRunById(taskRunId);
    const artifacts = await this.artifactRepository.getArtifactsByRunId(taskRunId);
    const solutions = await this.solutionRepository.getTaskRunSolutions(taskRunId);
    return {
      ...run,
      solutions,
      artifacts: await Promise.all(
        artifacts.map(async (artifact) => ({
          ...artifact,
          uri: artifact.type === 'pmtiles' ? await toPresignedPmtilesUrl(artifact.uri) : artifact.uri
        }))
      )
    };
  }

  /** Creates or updates normalized solver metadata for one run-local solution. */
  async upsertSolution(taskRunId: string, solution: UpsertTaskRunSolution): Promise<TaskRunWithArtifacts> {
    const run = await this.taskRunRepository.getTaskRunById(taskRunId);
    if (run.status === 'completed' || run.status === 'cancelled') {
      throw new ApiGeneralError('Solutions cannot be changed after a run reaches a terminal state.', []);
    }
    if (solution.solution_index !== 0 || solution.role !== 'reference') {
      throw new ApiGeneralError('Optimization runs expose exactly one reference solution at index 0.', []);
    }
    await this.solutionRepository.upsertTaskRunSolution(taskRunId, solution);
    return this.getTaskRunById(taskRunId);
  }

  /** Returns all runs for a task with artifacts. */
  async getTaskRunsByTaskId(taskId: string): Promise<TaskRunWithArtifacts[]> {
    const runs = await this.taskRunRepository.getTaskRunsByTaskId(taskId);
    return Promise.all(runs.map(async (run) => this.getTaskRunById(run.task_run_id)));
  }

  /** Applies an internal workflow lifecycle update. */
  async updateRun(taskRunId: string, updates: UpdateTaskRun): Promise<TaskRunWithArtifacts> {
    const current = await this.taskRunRepository.getTaskRunById(taskRunId);
    const allowedStatuses: Record<TaskRun['status'], TaskRun['status'][]> = {
      queued: ['queued', 'running', 'failed', 'cancelled'],
      running: ['running', 'completed', 'failed', 'cancelled'],
      completed: ['completed'],
      failed: ['failed', 'running', 'cancelled'],
      cancelled: ['cancelled']
    };
    if (updates.status && !allowedStatuses[current.status].includes(updates.status)) {
      throw new ApiGeneralError(`Invalid run status transition from ${current.status} to ${updates.status}.`, []);
    }
    if (updates.status === 'completed') {
      const artifacts = await this.artifactRepository.getArtifactsByRunId(taskRunId);
      const requiredTypes = ['canonical_result', 'pmtiles'];
      const requiredReady = requiredTypes.every((type) =>
        artifacts.some((artifact) => artifact.type === type && artifact.status === 'ready')
      );
      if (!requiredReady) {
        throw new ApiGeneralError('A run cannot complete before canonical result and PMTiles artifacts are ready.', []);
      }
      const solutions = await this.solutionRepository.getTaskRunSolutions(taskRunId);
      if (
        ['continuous_optimization', 'discrete_optimization', 'priority_ranking'].includes(current.task_type) &&
        (solutions.length !== 1 || solutions[0].role !== 'reference')
      ) {
        throw new ApiGeneralError('An optimization run requires exactly one normalized reference solution.', []);
      }
    }
    await this.taskRunRepository.updateTaskRun(taskRunId, updates);
    if (updates.status === 'running') {
      await this.taskService.updateTaskExecution(current.task_id, { status: 'running', status_message: null });
    }
    if (updates.status === 'completed') {
      await this.taskService.updateTaskExecution(current.task_id, { status: 'completed', status_message: null });
    }
    if (updates.status === 'failed') {
      await this.taskService.updateTaskExecution(current.task_id, {
        status: 'failed',
        status_message: updates.failure_message ?? 'Task run failed.'
      });
    }
    return this.getTaskRunById(taskRunId);
  }

  /** Updates one authoritative run artifact by role. */
  async updateArtifact(taskRunId: string, type: ArtifactType, updates: UpdateArtifact): Promise<TaskRunWithArtifacts> {
    const run = await this.taskRunRepository.getTaskRunById(taskRunId);
    const artifact = await this.artifactRepository.getArtifactByRunAndType(taskRunId, type);
    const allowedStatuses: Record<typeof artifact.status, (typeof artifact.status)[]> = {
      pending: ['pending', 'building', 'failed'],
      building: ['building', 'ready', 'failed'],
      ready: ['ready'],
      failed: ['failed', 'building']
    };
    if (updates.status && !allowedStatuses[artifact.status].includes(updates.status)) {
      throw new ApiGeneralError(
        `Invalid ${type} artifact transition from ${artifact.status} to ${updates.status}.`,
        []
      );
    }
    await this.artifactRepository.updateArtifact(artifact.artifact_id, updates);
    if (updates.status === 'ready' && updates.uri && type === 'raw_solver_result') {
      await this.taskService.updateTaskExecution(run.task_id, { output_uri: updates.uri });
    }
    if (updates.status === 'ready' && updates.uri && type === 'pmtiles') {
      await this.taskService.updateTaskExecution(run.task_id, { tileset_uri: updates.uri });
    }
    return this.getTaskRunById(taskRunId);
  }

  /** Returns the immutable engine configuration for the classified formulation. */
  private getExecutionConfiguration(
    optimizationMode: 'interactive' | 'balanced' | 'exact_audit' = 'exact_audit'
  ): Record<string, unknown> {
    return {
      engine: 'highs',
      adapter_version: 'highs-csr-v2',
      required_status: optimizationMode === 'exact_audit' ? 'optimal' : 'feasible',
      relative_mip_gap: optimizationMode === 'exact_audit' ? 0 : optimizationMode === 'balanced' ? 0.05 : 0.15,
      exact: optimizationMode === 'exact_audit'
    };
  }

  /** Returns the immutable, queryable implementation version for an execution method. */
  private getExecutionMethodVersion(executionMethod: TaskRunExecutionMethod): string {
    if (executionMethod === 'compiled_priority_ranking') {
      return 'highs-csr-priority-ranking-v1';
    }
    return executionMethod === 'compiled_continuous_optimization'
      ? 'highs-csr-continuous-v1'
      : 'highs-csr-discrete-v1';
  }

  /** Returns only artifacts crossed by the selected durable execution path. */
  private getArtifactTypes(exportSelectedParquet: boolean): ArtifactType[] {
    const common: ArtifactType[] = ['planning_unit_inventory'];
    const outputs: ArtifactType[] = [
      'canonical_result',
      ...(exportSelectedParquet ? (['canonical_export'] as ArtifactType[]) : []),
      'pmtiles'
    ];
    return [...common, 'compiled_model', 'raw_solver_result', ...outputs];
  }

  /** Returns deterministic latency and refinement controls for the selected product mode. */
  private resolveWorkBudget(optimizationMode: 'interactive' | 'balanced' | 'exact_audit'): Record<string, unknown> {
    if (optimizationMode === 'interactive') {
      return {
        wall_time_seconds: 1800,
        relative_gap: 0.15
      };
    }
    if (optimizationMode === 'balanced') {
      return {
        wall_time_seconds: 7200,
        relative_gap: 0.05
      };
    }
    return {
      wall_time_seconds: 86400,
      relative_gap: 0
    };
  }

  /** Validate and normalize the optional soft selected-neighbor preference. */
  private resolveNeighborPenalty(request: SubmitTaskRequest['neighbor_penalty']): { strength: number } | null {
    if (request == null || request.strength === 0) {
      return null;
    }
    if (!Number.isFinite(request.strength) || request.strength < 0) {
      throw new ApiGeneralError('Neighbor-penalty strength must be a finite nonnegative number.', []);
    }
    return { strength: request.strength };
  }

  /** Estimates area from a published projected [left,bottom,right,top] extent. */
  private estimateGridExtentArea(value: unknown): number | null {
    if (
      !Array.isArray(value) ||
      value.length !== 4 ||
      !value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    ) {
      return null;
    }
    return Math.abs((value[2] - value[0]) * (value[3] - value[1]));
  }
}
