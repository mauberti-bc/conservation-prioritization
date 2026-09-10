import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTP400, HTTP404 } from '../../../errors/http-error';
import { MarkdownService } from '../../../services/markdown-service';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../../__mocks__/db';
import { getMarkdown } from './index';

chai.use(sinonChai);

describe('get markdown endpoint', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns a Markdown document and releases the connection', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const service = sinon.stub(MarkdownService.prototype, 'getMarkdown').resolves({
      key: 'tutorial',
      data: '# Tutorial'
    });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { key: 'tutorial' };

    await getMarkdown()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnceWith('tutorial');
    expect(mockRes.status).to.have.been.calledOnceWith(200);
    expect(mockRes.json).to.have.been.calledOnceWith({ key: 'tutorial', data: '# Tutorial' });
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('propagates missing document errors and rolls back', async () => {
    const connection = registerMockDBConnection({ rollback: sinon.stub().resolves(), release: sinon.stub() });
    const failure = new HTTP404('Markdown document not found.');
    sinon.stub(MarkdownService.prototype, 'getMarkdown').rejects(failure);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { key: 'tutorial' };

    try {
      await getMarkdown()(mockReq, mockRes, () => {});
      expect.fail('Expected HTTP404');
    } catch (error) {
      expect(error).to.equal(failure);
    }

    expect(mockRes.status).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rejects malformed Markdown keys before opening a connection', async () => {
    const connection = registerMockDBConnection({ open: sinon.stub().resolves() });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { key: 'getting started' };

    try {
      await getMarkdown()(mockReq, mockRes, () => {});
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
    }

    expect(connection.open).not.to.have.been.called;
    expect(mockRes.status).not.to.have.been.called;
  });
});
