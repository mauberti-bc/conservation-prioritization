import { IDBConnection } from '../database/db';
import { HTTP400, HTTP404, HTTP409 } from '../errors/http-error';
import {
  AdminMarkdown,
  AdminMarkdownListItem,
  CreateMarkdown,
  MarkdownKey,
  REQUIRED_MARKDOWN_KEYS,
  UpdateMarkdown
} from '../models/markdown';
import { ApiPaginationOptions, ApiPaginationResults } from '../models/pagination';
import { MarkdownRepository } from '../repositories/markdown-repository';
import { makePaginationResponse } from '../utils/pagination';
import { DBService } from './db-service';

/** Service for administrative Markdown CRUD operations. */
export class AdminMarkdownService extends DBService {
  markdownRepository: MarkdownRepository;

  /**
   * Creates an instance of AdminMarkdownService.
   *
   * @param {IDBConnection} connection Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.markdownRepository = new MarkdownRepository(connection);
  }

  /**
   * Returns paginated Markdown records for administration.
   *
   * @param {ApiPaginationOptions} pagination Pagination and sorting options.
   * @param {string} [search] Optional key/data search term.
   * @returns {Promise<{ markdown: AdminMarkdownListItem[]; pagination: ApiPaginationResults }>}
   */
  async getMarkdowns(
    pagination: ApiPaginationOptions,
    search?: string
  ): Promise<{ markdown: AdminMarkdownListItem[]; pagination: ApiPaginationResults }> {
    const { markdown, total } = await this.markdownRepository.getMarkdowns(pagination, search);

    return {
      markdown,
      pagination: makePaginationResponse(total, pagination)
    };
  }

  /**
   * Returns one administrative Markdown record.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<AdminMarkdown>} Administrative Markdown detail.
   * @throws {HTTP404} When the record does not exist.
   */
  async getMarkdown(markdownId: string): Promise<AdminMarkdown> {
    const markdown = await this.markdownRepository.getMarkdownById(markdownId);

    if (!markdown) {
      throw new HTTP404('Markdown document not found.');
    }

    return markdown;
  }

  /**
   * Creates a Markdown document after validating uniqueness.
   *
   * @param {CreateMarkdown} markdown Markdown key and source data.
   * @returns {Promise<AdminMarkdown>} Created Markdown record.
   * @throws {HTTP409} When the key already exists.
   */
  async createMarkdown(markdown: CreateMarkdown): Promise<AdminMarkdown> {
    await this.ensureUniqueKey(markdown.key);

    return this.markdownRepository.createMarkdown(markdown);
  }

  /**
   * Updates a Markdown document while protecting application-required keys.
   *
   * @param {string} markdownId Markdown UUID.
   * @param {UpdateMarkdown} updates Key/data patch.
   * @returns {Promise<AdminMarkdown>} Updated Markdown record.
   * @throws {HTTP400} When an application-required key would be renamed.
   * @throws {HTTP404} When the record does not exist.
   * @throws {HTTP409} When the target key already exists.
   */
  async updateMarkdown(markdownId: string, updates: UpdateMarkdown): Promise<AdminMarkdown> {
    const existing = await this.getMarkdown(markdownId);

    if (updates.key !== undefined && updates.key !== existing.key) {
      if (this.isRequiredMarkdownKey(existing.key)) {
        throw new HTTP400('The tutorial Markdown key cannot be renamed.');
      }

      await this.ensureUniqueKey(updates.key, markdownId);
    }

    const updated = await this.markdownRepository.updateMarkdown(markdownId, updates);

    if (!updated) {
      throw new HTTP404('Markdown document not found.');
    }

    return updated;
  }

  /**
   * Deletes a Markdown document when it is not application-required.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<void>} Resolves when deletion succeeds.
   * @throws {HTTP400} When deleting an application-required key.
   * @throws {HTTP404} When the record does not exist.
   */
  async deleteMarkdown(markdownId: string): Promise<void> {
    const existing = await this.getMarkdown(markdownId);

    if (this.isRequiredMarkdownKey(existing.key)) {
      throw new HTTP400('The tutorial Markdown document cannot be deleted.');
    }

    const deleted = await this.markdownRepository.deleteMarkdown(markdownId);

    if (!deleted) {
      throw new HTTP404('Markdown document not found.');
    }
  }

  /**
   * Checks whether a key belongs to an application-required Markdown document.
   *
   * @param {MarkdownKey} key Markdown key.
   * @returns {boolean} True when the key is application-required.
   */
  private isRequiredMarkdownKey(key: MarkdownKey): boolean {
    return REQUIRED_MARKDOWN_KEYS.includes(key as (typeof REQUIRED_MARKDOWN_KEYS)[number]);
  }

  /**
   * Ensures no other Markdown row already uses a key.
   *
   * @param {MarkdownKey} key Candidate Markdown key.
   * @param {string} [currentMarkdownId] Existing row allowed to keep the key.
   * @returns {Promise<void>}
   * @throws {HTTP409} When another row already uses the key.
   */
  private async ensureUniqueKey(key: MarkdownKey, currentMarkdownId?: string): Promise<void> {
    const existing = await this.markdownRepository.getMarkdownByKey(key);

    if (existing && existing.markdown_id !== currentMarkdownId) {
      throw new HTTP409('Markdown key already exists.');
    }
  }
}
