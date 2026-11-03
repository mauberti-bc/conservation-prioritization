import { SQL } from 'sql-template-strings';
import {
  AdminMarkdown,
  AdminMarkdownListItem,
  CreateMarkdown,
  Markdown,
  MarkdownKey,
  UpdateMarkdown
} from '../models/markdown';
import { ApiPaginationOptions } from '../models/pagination';
import { BaseRepository } from './base-repository';

const MARKDOWN_SORT_FIELDS: Record<string, string> = {
  key: 'key',
  createdAt: 'created_at',
  created_at: 'created_at',
  updatedAt: 'updated_at',
  updated_at: 'updated_at'
};

/**
 * Repository for application-managed Markdown documents.
 */
export class MarkdownRepository extends BaseRepository {
  /**
   * Fetches a Markdown document by its stable application key.
   *
   * @param {MarkdownKey} key Stable application-owned Markdown identifier.
   * @returns {Promise<Markdown | null>} The Markdown row if found, otherwise null.
   */
  async getMarkdownByKey(key: MarkdownKey): Promise<Markdown | null> {
    const response = await this.connection.sql(
      SQL`
        SELECT markdown_id, key, data, created_at, created_by, updated_at, updated_by
        FROM markdown
        WHERE key = ${key}
        LIMIT 1
      `,
      Markdown
    );

    return response.rows[0] ?? null;
  }

  /**
   * Fetches a Markdown document by primary key.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<AdminMarkdown | null>} The Markdown row if found, otherwise null.
   */
  async getMarkdownById(markdownId: string): Promise<AdminMarkdown | null> {
    const response = await this.connection.sql(
      SQL`
        SELECT markdown_id, key, data, created_at, created_by, updated_at, updated_by
        FROM markdown
        WHERE markdown_id = ${markdownId}
        LIMIT 1
      `,
      AdminMarkdown
    );

    return response.rows[0] ?? null;
  }

  /**
   * Fetches paginated Markdown records for administration.
   *
   * @param {ApiPaginationOptions} pagination Server-side pagination and sorting options.
   * @param {string} [search] Optional case-insensitive key/data search term.
   * @returns {Promise<{ markdown: AdminMarkdownListItem[]; total: number }>} Paginated rows and total count.
   */
  async getMarkdowns(
    pagination: ApiPaginationOptions,
    search?: string
  ): Promise<{ markdown: AdminMarkdownListItem[]; total: number }> {
    const sortField = this.resolveMarkdownSortField(pagination.sort);
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (pagination.page - 1) * pagination.limit;
    const normalizedSearch = search?.trim();
    const likeSearch = normalizedSearch ? `%${normalizedSearch}%` : null;

    const countStatement = SQL`
      SELECT COUNT(*)::int AS total
      FROM markdown
      WHERE 1 = 1
    `;

    if (likeSearch) {
      countStatement.append(SQL` AND (key ILIKE ${likeSearch} OR data ILIKE ${likeSearch})`);
    }

    const countResponse = await this.connection.sql(countStatement);
    const total = countResponse.rows?.[0]?.total ?? 0;

    const sqlStatement = SQL`
      SELECT
        markdown_id,
        key,
        LEFT(REGEXP_REPLACE(data, '\\s+', ' ', 'g'), 240) AS preview,
        created_at,
        created_by,
        updated_at,
        updated_by
      FROM markdown
      WHERE 1 = 1
    `;

    if (likeSearch) {
      sqlStatement.append(SQL` AND (key ILIKE ${likeSearch} OR data ILIKE ${likeSearch})`);
    }

    sqlStatement.append(` ORDER BY ${sortField} ${sortOrder}, markdown_id ASC`);
    sqlStatement.append(SQL` LIMIT ${pagination.limit} OFFSET ${offset}`);

    const response = await this.connection.sql(sqlStatement, AdminMarkdownListItem);

    return {
      markdown: response.rows,
      total
    };
  }

  /**
   * Creates a Markdown document.
   *
   * @param {CreateMarkdown} markdown Markdown key and source data.
   * @returns {Promise<AdminMarkdown>} Created Markdown row.
   */
  async createMarkdown(markdown: CreateMarkdown): Promise<AdminMarkdown> {
    const response = await this.connection.sql(
      SQL`
        INSERT INTO markdown (key, data)
        VALUES (${markdown.key}, ${markdown.data})
        RETURNING markdown_id, key, data, created_at, created_by, updated_at, updated_by
      `,
      AdminMarkdown
    );

    return response.rows[0];
  }

  /**
   * Updates an existing Markdown document.
   *
   * @param {string} markdownId Markdown UUID.
   * @param {UpdateMarkdown} updates Key/data changes.
   * @returns {Promise<AdminMarkdown | null>} Updated Markdown row, or null if no row exists.
   */
  async updateMarkdown(markdownId: string, updates: UpdateMarkdown): Promise<AdminMarkdown | null> {
    let sqlStatement;

    if (updates.key !== undefined && updates.data !== undefined) {
      sqlStatement = SQL`
        UPDATE markdown
        SET key = ${updates.key}, data = ${updates.data}
        WHERE markdown_id = ${markdownId}
        RETURNING markdown_id, key, data, created_at, created_by, updated_at, updated_by
      `;
    } else if (updates.key !== undefined) {
      sqlStatement = SQL`
        UPDATE markdown
        SET key = ${updates.key}
        WHERE markdown_id = ${markdownId}
        RETURNING markdown_id, key, data, created_at, created_by, updated_at, updated_by
      `;
    } else if (updates.data !== undefined) {
      sqlStatement = SQL`
        UPDATE markdown
        SET data = ${updates.data}
        WHERE markdown_id = ${markdownId}
        RETURNING markdown_id, key, data, created_at, created_by, updated_at, updated_by
      `;
    } else {
      return null;
    }

    const response = await this.connection.sql(sqlStatement, AdminMarkdown);

    return response.rows[0] ?? null;
  }

  /**
   * Deletes a Markdown document.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<boolean>} True when a row was deleted.
   */
  async deleteMarkdown(markdownId: string): Promise<boolean> {
    const response = await this.connection.sql(SQL`DELETE FROM markdown WHERE markdown_id = ${markdownId}`);

    return response.rowCount === 1;
  }

  /**
   * Resolve a safe Markdown sort field.
   *
   * @param {string} [sort] API sort key.
   * @returns {string} Database column name.
   */
  private resolveMarkdownSortField(sort?: string): string {
    return MARKDOWN_SORT_FIELDS[sort ?? ''] ?? 'created_at';
  }
}
