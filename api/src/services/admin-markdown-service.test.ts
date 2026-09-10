import { expect } from 'chai';
import sinon from 'sinon';
import { HTTP400, HTTP404, HTTP409 } from '../errors/http-error';
import { MarkdownRepository } from '../repositories/markdown-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { AdminMarkdownService } from './admin-markdown-service';

const tutorialMarkdown = {
  markdown_id: '00000000-0000-0000-0000-000000000001',
  key: 'tutorial',
  data: '# Tutorial',
  created_at: '2026-09-10T12:00:00.000Z',
  created_by: null,
  updated_at: null,
  updated_by: null
};

describe('AdminMarkdownService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('rejects duplicate keys on create', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownByKey').resolves(tutorialMarkdown);

    try {
      await new AdminMarkdownService(getMockDBConnection()).createMarkdown({ key: 'tutorial', data: '# Tutorial' });
      expect.fail('Expected HTTP409');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }
  });

  it('prevents renaming the reserved tutorial key', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownById').resolves(tutorialMarkdown);

    try {
      await new AdminMarkdownService(getMockDBConnection()).updateMarkdown(tutorialMarkdown.markdown_id, {
        key: 'getting-started'
      });
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
    }
  });

  it('allows updating tutorial content', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownById').resolves(tutorialMarkdown);
    const update = sinon.stub(MarkdownRepository.prototype, 'updateMarkdown').resolves({
      ...tutorialMarkdown,
      data: '# Updated'
    });

    const result = await new AdminMarkdownService(getMockDBConnection()).updateMarkdown(tutorialMarkdown.markdown_id, {
      data: '# Updated'
    });

    expect(result.data).to.equal('# Updated');
    expect(update).to.have.been.calledOnceWith(tutorialMarkdown.markdown_id, { data: '# Updated' });
  });

  it('prevents deleting the reserved tutorial key', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownById').resolves(tutorialMarkdown);

    try {
      await new AdminMarkdownService(getMockDBConnection()).deleteMarkdown(tutorialMarkdown.markdown_id);
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
    }
  });

  it('throws HTTP404 for missing detail', async () => {
    sinon.stub(MarkdownRepository.prototype, 'getMarkdownById').resolves(null);

    try {
      await new AdminMarkdownService(getMockDBConnection()).getMarkdown(tutorialMarkdown.markdown_id);
      expect.fail('Expected HTTP404');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP404);
    }
  });
});
