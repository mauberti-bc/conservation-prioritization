import { AxiosInstance } from 'axios';
import {
  AdminMarkdown,
  ApiMarkdown,
  GetAdminMarkdownResponse,
  MarkdownKey,
  MarkdownPatchRequest,
  MarkdownWriteRequest,
} from 'hooks/interfaces/useMarkdownApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for application-managed Markdown documents.
 *
 * @param {AxiosInstance} axios Axios instance for making HTTP requests.
 * @returns Object containing Markdown API methods.
 */
export const useMarkdownApi = (axios: AxiosInstance) => {
  /**
   * Retrieve a Markdown document by stable application key.
   *
   * @param {MarkdownKey} key Stable application-owned Markdown identifier.
   * @returns {Promise<ApiMarkdown>} The Markdown document.
   */
  const getMarkdown = async (key: MarkdownKey): Promise<ApiMarkdown> => {
    const { data } = await axios.get<ApiMarkdown>(`/api/markdown/${key}`);
    return data;
  };

  /**
   * Retrieve Markdown documents for administration.
   *
   * @param {ApiPaginationRequestOptions} pagination Pagination, sorting, and search options.
   * @returns {Promise<GetAdminMarkdownResponse>} Paginated administrative Markdown rows.
   */
  const getAdminMarkdown = async (pagination: ApiPaginationRequestOptions): Promise<GetAdminMarkdownResponse> => {
    const { data } = await axios.get<GetAdminMarkdownResponse>('/api/admin/markdown', {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
    });
    return data;
  };

  /**
   * Retrieve one complete Markdown document for administration.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<AdminMarkdown>} Administrative Markdown detail.
   */
  const getAdminMarkdownById = async (markdownId: string): Promise<AdminMarkdown> => {
    const { data } = await axios.get<AdminMarkdown>(`/api/admin/markdown/${markdownId}`);
    return data;
  };

  /**
   * Create a Markdown document.
   *
   * @param {MarkdownWriteRequest} payload Markdown key and source data.
   * @returns {Promise<AdminMarkdown>} Created Markdown document.
   */
  const createAdminMarkdown = async (payload: MarkdownWriteRequest): Promise<AdminMarkdown> => {
    const { data } = await axios.post<AdminMarkdown>('/api/admin/markdown', payload);
    return data;
  };

  /**
   * Update a Markdown document.
   *
   * @param {string} markdownId Markdown UUID.
   * @param {MarkdownPatchRequest} payload Markdown key/data updates.
   * @returns {Promise<AdminMarkdown>} Updated Markdown document.
   */
  const updateAdminMarkdown = async (markdownId: string, payload: MarkdownPatchRequest): Promise<AdminMarkdown> => {
    const { data } = await axios.put<AdminMarkdown>(`/api/admin/markdown/${markdownId}`, payload);
    return data;
  };

  /**
   * Delete a Markdown document.
   *
   * @param {string} markdownId Markdown UUID.
   * @returns {Promise<void>} Resolves when deletion succeeds.
   */
  const deleteAdminMarkdown = async (markdownId: string): Promise<void> => {
    await axios.delete(`/api/admin/markdown/${markdownId}`);
  };

  return {
    getMarkdown,
    getAdminMarkdown,
    getAdminMarkdownById,
    createAdminMarkdown,
    updateAdminMarkdown,
    deleteAdminMarkdown,
  };
};
