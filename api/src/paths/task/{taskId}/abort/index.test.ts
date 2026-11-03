import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TaskService } from '../../../../services/task-service';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../../../__mocks__/db';
import { abortTask } from './index';

chai.use(sinonChai);

describe('abort task endpoint', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns accepted after requesting cancellation and releases the connection', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const abort = sinon.stub(TaskService.prototype, 'abortTask').resolves();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { taskId: 'task-id' };
    mockRes.send = sinon.stub().returns(mockRes);
    await abortTask()(mockReq, mockRes, () => {});
    expect(abort).to.have.been.calledOnceWith('task-id');
    expect(mockRes.status).to.have.been.calledOnceWith(202);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('propagates cancellation failures and rolls back without returning success', async () => {
    const connection = registerMockDBConnection({ rollback: sinon.stub().resolves(), release: sinon.stub() });
    const failure = new Error('Prefect unavailable');
    sinon.stub(TaskService.prototype, 'abortTask').rejects(failure);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { taskId: 'task-id' };
    try {
      await abortTask()(mockReq, mockRes, () => {});
      expect.fail('Expected cancellation failure');
    } catch (error) {
      expect(error).to.equal(failure);
    }
    expect(mockRes.status).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
