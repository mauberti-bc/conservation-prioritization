import { IDBConnection } from '../database/db';
import { HTTP404 } from '../errors/http-error';
import { ApiMarkdown, MarkdownKey } from '../models/markdown';
import { MarkdownRepository } from '../repositories/markdown-repository';
import { DBService } from './db-service';

/** Service for retrieving application-managed Markdown documents. */
export class MarkdownService extends DBService {
  markdownRepository: MarkdownRepository;

  /**
   * Creates an instance of MarkdownService.
   *
   * @param {IDBConnection} connection Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.markdownRepository = new MarkdownRepository(connection);
  }

  /**
   * Returns a Markdown document for application display.
   *
   * @param {MarkdownKey} key Stable Markdown slug.
   * @returns {Promise<ApiMarkdown>} Public Markdown document fields.
   * @throws {HTTP404} When the requested Markdown document has not been seeded.
   */
  async getMarkdown(key: MarkdownKey): Promise<ApiMarkdown> {
    const markdown = await this.markdownRepository.getMarkdownByKey(key);

    if (!markdown) {
      throw new HTTP404('Markdown document not found.');
    }

    return ApiMarkdown.parse({
      key: markdown.key,
      data: markdown.data
    });
  }
}
