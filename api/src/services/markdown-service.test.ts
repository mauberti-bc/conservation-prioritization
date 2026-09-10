import { expect } from 'chai';
import sinon from 'sinon';
import { HTTP404 } from '../errors/http-error';
import { MarkdownRepository } from '../repositories/markdown-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { MarkdownService } from './markdown-service';

describe('MarkdownService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns only public Markdown fields', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownByKey').resolves({
      markdown_id: '00000000-0000-0000-0000-000000000001',
      key: 'tutorial',
      data: '# Tutorial',
      created_at: '2026-09-10T12:00:00.000Z',
      created_by: '00000000-0000-0000-0000-000000000002',
      updated_at: '2026-09-10T12:00:00.000Z',
      updated_by: '00000000-0000-0000-0000-000000000002'
    });

    const result = await new MarkdownService(getMockDBConnection()).getMarkdown('tutorial');

    expect(result).to.eql({ key: 'tutorial', data: '# Tutorial' });
  });

  it('throws HTTP404 when the Markdown document is missing', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownByKey').resolves(null);

    try {
      await new MarkdownService(getMockDBConnection()).getMarkdown('tutorial');
      expect.fail('Expected HTTP404');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP404);
    }
  });
});
