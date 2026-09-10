import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { TaskRun } from '../models/task-run';
import { ArtifactRepository } from '../repositories/artifact-repository';
import { TaskRunRepository } from '../repositories/task-run-repository';
import { TaskRunService } from './task-run-service';
import { TaskService } from './task-service';

describe('TaskRunService completion', () => {
  afterEach(() => {
    sinon.restore();
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
        expect(updateRun.calledOnce).to.equal(true);
        expect(updateTask.firstCall.args).to.deep.equal([
          'task-id',
          { status: 'completed', status_message: 'No feasible solution satisfies the selected constraints.' }
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
});
