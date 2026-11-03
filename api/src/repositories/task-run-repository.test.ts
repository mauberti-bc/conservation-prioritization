import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { TaskRunRepository } from './task-run-repository';

describe('TaskRunRepository lifecycle SQL', () => {
  for (const status of ['running', 'completed', 'infeasible'] as const) {
    it(`clears failure metadata exactly once when ${status}`, async () => {
      const sql = sinon.stub().resolves({ rowCount: 1, rows: [{}] });
      const repository = new TaskRunRepository(getMockDBConnection({ sql }));
      await repository.updateTaskRun('run-id', {
        status,
        failure_code: null,
        failure_message: null
      });
      const statement = sql.firstCall.args[0].text;
      expect(statement.match(/failure_code\s*=/g)).to.have.length(1);
      expect(statement.match(/failure_message\s*=/g)).to.have.length(1);
      expect(statement).to.include('failure_code = NULL');
      expect(statement).to.include('failure_message = NULL');
      if (status !== 'running') {
        expect(statement).to.include('completed_at = now()');
      }
    });
  }

  it('preserves diagnostic metadata for execution failures', async () => {
    const sql = sinon.stub().resolves({ rowCount: 1, rows: [{}] });
    await new TaskRunRepository(getMockDBConnection({ sql })).updateTaskRun('run-id', {
      status: 'failed',
      failure_code: 'solve_error',
      failure_message: 'Solver failed.'
    });
    expect(sql.firstCall.args[0].values).to.include('solve_error');
    expect(sql.firstCall.args[0].values).to.include('Solver failed.');
  });
});
