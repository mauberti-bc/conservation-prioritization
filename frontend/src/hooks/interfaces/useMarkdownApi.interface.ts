import { ApiPaginationResponseParams } from 'types/pagination';

export type MarkdownKey = string;

export interface ApiMarkdown {
  key: MarkdownKey;
  data: string;
}

export interface AdminMarkdownListItem {
  markdown_id: string;
  key: MarkdownKey;
  preview: string;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AdminMarkdown extends Omit<AdminMarkdownListItem, 'preview'> {
  data: string;
}

export interface MarkdownWriteRequest {
  key: MarkdownKey;
  data: string;
}

export interface MarkdownPatchRequest {
  key?: MarkdownKey;
  data?: string;
}

export interface GetAdminMarkdownResponse {
  markdown: AdminMarkdownListItem[];
  pagination: ApiPaginationResponseParams;
}
