import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTP400 } from '../../../../errors/http-error';
import { AdminMarkdownService } from '../../../../services/admin-markdown-service';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../../../__mocks__/db';
import { deleteMarkdown, getMarkdown, updateMarkdown } from './index';

chai.use(sinonChai);

const markdownId = '00000000-0000-0000-0000-000000000001';
const tutorialMarkdown = {
  markdown_id: markdownId,
  key: 'tutorial',
  data: '# Tutorial',
  created_at: '2026-09-10T12:00:00.000Z',
  created_by: null,
  updated_at: null,
  updated_by: null
};

describe('admin markdown detail endpoints', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns one Markdown record and releases the connection', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const service = sinon.stub(AdminMarkdownService.prototype, 'getMarkdown').resolves(tutorialMarkdown);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { markdownId };

    await getMarkdown()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnceWith(markdownId);
    expect(mockRes.status).to.have.been.calledOnceWith(200);
    expect(mockRes.json).to.have.been.calledOnceWith(tutorialMarkdown);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('updates a Markdown record and releases the connection', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const updatedMarkdown = { ...tutorialMarkdown, data: '# Updated' };
    const service = sinon.stub(AdminMarkdownService.prototype, 'updateMarkdown').resolves(updatedMarkdown);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { markdownId };
    mockReq.body = { data: '# Updated' };

    await updateMarkdown()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnceWith(markdownId, { data: '# Updated' });
    expect(mockRes.status).to.have.been.calledOnceWith(200);
    expect(mockRes.json).to.have.been.calledOnceWith(updatedMarkdown);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rejects empty update payloads before opening a connection', async () => {
    const connection = registerMockDBConnection({ open: sinon.stub().resolves() });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { markdownId };
    mockReq.body = {};

    try {
      await updateMarkdown()(mockReq, mockRes, () => {});
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
    }

    expect(connection.open).not.to.have.been.called;
    expect(mockRes.status).not.to.have.been.called;
  });

  it('deletes a Markdown record and returns no content', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const service = sinon.stub(AdminMarkdownService.prototype, 'deleteMarkdown').resolves();
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = { markdownId };

    await deleteMarkdown()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnceWith(markdownId);
    expect(mockRes.status).to.have.been.calledOnceWith(204);
    expect(mockRes.send).to.have.been.calledOnce;
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
