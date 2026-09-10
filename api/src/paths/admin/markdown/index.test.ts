import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { HTTP400 } from '../../../errors/http-error';
import { AdminMarkdownService } from '../../../services/admin-markdown-service';
import { getRequestHandlerMocks, registerMockDBConnection } from '../../../__mocks__/db';
import { createMarkdown, getMarkdowns } from './index';

chai.use(sinonChai);

describe('admin markdown collection endpoints', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns paginated Markdown records and releases the connection', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const service = sinon.stub(AdminMarkdownService.prototype, 'getMarkdowns').resolves({
      markdown: [
        {
          markdown_id: '00000000-0000-0000-0000-000000000001',
          key: 'tutorial',
          preview: '# Tutorial',
          created_at: '2026-09-10T12:00:00.000Z',
          created_by: null,
          updated_at: null,
          updated_by: null
        }
      ],
      pagination: { total: 1, current_page: 1, last_page: 1 }
    });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '25', sort: 'key', order: 'asc', search: 'tutorial' };

    await getMarkdowns()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnce;
    expect(mockRes.status).to.have.been.calledOnceWith(200);
    expect(mockRes.json).to.have.been.calledOnce;
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('creates a Markdown record and returns the admin document shape', async () => {
    const connection = registerMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    const markdown = {
      markdown_id: '00000000-0000-0000-0000-000000000002',
      key: 'getting-started',
      data: '# Conservation planning workflow',
      created_at: '2026-09-10T12:00:00.000Z',
      created_by: null,
      updated_at: null,
      updated_by: null
    };
    const service = sinon.stub(AdminMarkdownService.prototype, 'createMarkdown').resolves(markdown);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.body = { key: 'getting-started', data: '# Conservation planning workflow' };

    await createMarkdown()(mockReq, mockRes, () => {});

    expect(service).to.have.been.calledOnceWith({ key: 'getting-started', data: '# Conservation planning workflow' });
    expect(mockRes.status).to.have.been.calledOnceWith(201);
    expect(mockRes.json).to.have.been.calledOnceWith(markdown);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });

  it('rejects malformed create payloads before opening a connection', async () => {
    const connection = registerMockDBConnection({ open: sinon.stub().resolves() });
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.body = { key: 'Getting Started', data: '# Conservation planning workflow' };

    try {
      await createMarkdown()(mockReq, mockRes, () => {});
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
    }

    expect(connection.open).not.to.have.been.called;
    expect(mockRes.status).not.to.have.been.called;
  });
});
