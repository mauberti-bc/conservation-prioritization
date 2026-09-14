import { expect } from 'chai';
import sinon from 'sinon';
import { Artifact } from '../models/artifact';
import { TaskRun } from '../models/task-run';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { TaskRunService } from './task-run-service';
import { TaskService } from './task-service';

describe('TaskRunService completion', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('maps cancelled runs to aborted tasks', async () => {
    sinon
      .stub(TaskRunRepository.prototype, 'getTaskRunById')
      .resolves({ task_id: 'task-id', status: 'running' } as TaskRun);
    sinon.stub(TaskRunRepository.prototype, 'updateTaskRun').resolves();
    const updateTask = sinon.stub(TaskService.prototype, 'updateTaskExecution').resolves();
    await new TaskRunService(getMockDBConnection()).updateRun('run-id', { status: 'cancelled' });
    expect(updateTask.firstCall.args).to.deep.equal(['task-id', { status: 'aborted', status_message: null }]);
  });

  for (const solverStatus of ['infeasible', 'optimal', 'solve_error']) {
    it(`handles completion with solver status ${solverStatus}`, async () => {
      sinon.stub(TaskRunRepository.prototype, 'getTaskRunById').resolves({
        task_id: 'task-id',
        status: 'running',
        solver_status: null,
        task_type: 'discrete_optimization'
      } as TaskRun);
      sinon.stub(ArtifactRepository.prototype, 'getArtifactsByRunId').resolves([]);
      const updateRun = sinon.stub(TaskRunRepository.prototype, 'updateTaskRun').resolves();
      const updateTask = sinon.stub(TaskService.prototype, 'updateTaskExecution').resolves();
      const service = new TaskRunService(getMockDBConnection());

      if (solverStatus === 'infeasible') {
        await service.updateRun('run-id', { status: 'completed', solver_status: solverStatus });
        expect(updateRun.firstCall.args[1].status).to.equal('infeasible');
        expect(updateTask.firstCall.args).to.deep.equal([
          'task-id',
          { status: 'infeasible', status_message: 'No feasible solution satisfies the selected constraints.' }
        ]);
      } else {
        try {
          await service.updateRun('run-id', { status: 'completed', solver_status: solverStatus });
          expect.fail('Expected missing artifacts to prevent completion');
        } catch (error) {
          expect((error as Error).message).to.include('artifacts are ready');
        }
        expect(updateRun.called).to.equal(false);
        expect(updateTask.called).to.equal(false);
      }
    });
  }
  it('records infeasibility without requiring outputs and skips unfinished artifacts', async () => {
    sinon.stub(TaskRunRepository.prototype, 'getTaskRunById').resolves({
      task_id: 'task-id',
      status: 'running',
      solver_status: null
    } as TaskRun);
    sinon.stub(ArtifactRepository.prototype, 'getArtifactsByRunId').resolves([
      { artifact_id: 'raw', status: 'building' },
      { artifact_id: 'map', status: 'pending' },
      { artifact_id: 'input', status: 'ready' }
    ] as Artifact[]);
    const updateArtifact = sinon.stub(ArtifactRepository.prototype, 'updateArtifact').resolves();
    const updateRun = sinon.stub(TaskRunRepository.prototype, 'updateTaskRun').resolves();
    const updateTask = sinon.stub(TaskService.prototype, 'updateTaskExecution').resolves();
    await new TaskRunService(getMockDBConnection()).updateRun('run-id', {
      status: 'infeasible',
      solver_status: 'infeasible'
    });
    expect(updateArtifact.args).to.deep.equal([
      ['raw', { status: 'skipped' }],
      ['map', { status: 'skipped' }]
    ]);
    expect(updateRun.firstCall.args[1].status).to.equal('infeasible');
    expect(updateTask.firstCall.args[1].status).to.equal('infeasible');
  });

  it('rejects infeasibility without solver evidence', async () => {
    sinon.stub(TaskRunRepository.prototype, 'getTaskRunById').resolves({
      task_id: 'task-id',
      status: 'running',
      solver_status: 'time_limit'
    } as TaskRun);
    const updateRun = sinon.stub(TaskRunRepository.prototype, 'updateTaskRun').resolves();
    try {
      await new TaskRunService(getMockDBConnection()).updateRun('run-id', { status: 'infeasible' });
      expect.fail('Expected solver evidence to be required');
    } catch (error) {
      expect((error as Error).message).to.include('solver evidence');
    }
    expect(updateRun.called).to.equal(false);
  });
  it('keeps infeasible runs terminal while accepting repeated outcome callbacks', async () => {
    sinon.stub(TaskRunRepository.prototype, 'getTaskRunById').resolves({
      task_id: 'task-id',
      status: 'infeasible',
      solver_status: 'infeasible'
    } as TaskRun);
    sinon.stub(ArtifactRepository.prototype, 'getArtifactsByRunId').resolves([]);
    const updateRun = sinon.stub(TaskRunRepository.prototype, 'updateTaskRun').resolves();
    sinon.stub(TaskService.prototype, 'updateTaskExecution').resolves();
    const service = new TaskRunService(getMockDBConnection());
    await service.updateRun('run-id', { status: 'infeasible', solver_status: 'infeasible' });
    expect(updateRun.calledOnce).to.equal(true);
    for (const status of ['running', 'failed', 'cancelled'] as const) {
      try {
        await service.updateRun('run-id', { status });
        expect.fail('Expected terminal outcome to reject the transition');
      } catch (error) {
        expect((error as Error).message).to.include('Invalid run status transition');
      }
    }
    expect(updateRun.calledOnce).to.equal(true);
  });
});
