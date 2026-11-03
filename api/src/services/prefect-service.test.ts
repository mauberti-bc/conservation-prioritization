import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { PrefectService } from './prefect-service';

chai.use(sinonChai);

describe('PrefectService task export dispatch', () => {
  const originalPrefectApiUrl = process.env.PREFECT_API_URL;

  beforeEach(() => {
    process.env.PREFECT_API_URL = 'http://prefect.example/api';
  });

  afterEach(() => {
    if (originalPrefectApiUrl) {
      process.env.PREFECT_API_URL = originalPrefectApiUrl;
    } else {
      delete process.env.PREFECT_API_URL;
    }
    sinon.restore();
  });

  it('requests cancelling without forcing a terminal state', async () => {
    const service = new PrefectService();
    const post = sinon
      .stub((service as any).axios, 'post')
      .resolves({ data: { status: 'ACCEPT', state: { type: 'CANCELLING' } } });
    await service.cancelFlowRun('flow-id');
    expect(post).to.have.been.calledOnceWith('/flow_runs/flow-id/set_state', {
      state: { type: 'CANCELLING', message: 'Abort requested by a conservation task user.' },
      force: false
    });
  });

  for (const state of ['CANCELLING', 'CANCELLED']) {
    it(`accepts an already ${state} flow`, async () => {
      const service = new PrefectService();
      sinon.stub((service as any).axios, 'post').resolves({ data: { status: 'REJECT', state: { type: state } } });
      await service.cancelFlowRun('flow-id');
    });
  }

  it('propagates orchestration rejection even when HTTP succeeds', async () => {
    const service = new PrefectService();
    sinon.stub((service as any).axios, 'post').resolves({ data: { status: 'ABORT', state: null } });
    try {
      await service.cancelFlowRun('flow-id');
      expect.fail('Expected cancellation to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('Failed to cancel Prefect flow run');
    }
  });

  it('submits task export runs to the task-export deployment', async () => {
    const service = new PrefectService();
    const resolveDeploymentIdStub = sinon.stub(service, 'resolveDeploymentId').resolves('deployment-id');
    const axios = (service as any).axios;
    const postStub = sinon.stub(axios, 'post').resolves({ data: { id: 'flow-run-id' } });

    const submitted = await service.submitTaskExport('export-id', 4);

    expect(submitted).to.deep.equal({ deploymentId: 'deployment-id', flowRunId: 'flow-run-id' });
    expect(resolveDeploymentIdStub).to.have.been.calledOnceWith('task_export', 'task-export');
    expect(postStub).to.have.been.calledOnceWith('/deployments/deployment-id/create_flow_run', {
      parameters: { task_export_id: 'export-id', attempt: 4 },
      idempotency_key: 'task-export:export-id'
    });
  });
});
