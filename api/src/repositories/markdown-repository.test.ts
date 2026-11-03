import { expect } from 'chai';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { MarkdownRepository } from './markdown-repository';

describe('MarkdownRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns a Markdown row by key', async () => {
    const markdown = {
      markdown_id: '00000000-0000-0000-0000-000000000001',
      key: 'tutorial',
      data: '# Tutorial',
      created_at: '2026-09-10T12:00:00.000Z',
      created_by: null,
      updated_at: null,
      updated_by: null
    };
    const sql = sinon.stub().resolves({ rows: [markdown], rowCount: 1 });
    const connection = getMockDBConnection({ sql });

    const result = await new MarkdownRepository(connection).getMarkdownByKey('tutorial');

    expect(result).to.eql(markdown);
    expect(sql).to.have.been.calledOnce;
    expect(sql.firstCall.args[0].values).to.eql(['tutorial']);
    expect(sql.firstCall.args[1]).to.exist;
  });

  it('returns null when no Markdown row exists for the key', async () => {
    const sql = sinon.stub().resolves({ rows: [], rowCount: 0 });
    const connection = getMockDBConnection({ sql });

    const result = await new MarkdownRepository(connection).getMarkdownByKey('tutorial');

    expect(result).to.be.null;
  });
});
