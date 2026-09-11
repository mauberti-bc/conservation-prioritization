import { z } from 'zod';

/**
 * Stable slug for application-managed Markdown documents.
 */
export const MarkdownKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type MarkdownKey = z.infer<typeof MarkdownKey>;

/**
 * Keys required by application routes and protected from rename/delete.
 */
export const REQUIRED_MARKDOWN_KEYS = ['tutorial'] as const;

/**
 * Markdown persistence model.
 */
export const Markdown = z.object({
  markdown_id: z.string().uuid(),
  key: MarkdownKey,
  data: z.string(),
  created_at: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().uuid().nullable()
});

export type Markdown = z.infer<typeof Markdown>;

/**
 * Public Markdown API response.
 */
export const ApiMarkdown = Markdown.pick({
  key: true,
  data: true
});

export type ApiMarkdown = z.infer<typeof ApiMarkdown>;

/**
 * Administrative Markdown list row.
 */
export const AdminMarkdownListItem = Markdown.pick({
  markdown_id: true,
  key: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true
}).extend({
  preview: z.string()
});

export type AdminMarkdownListItem = z.infer<typeof AdminMarkdownListItem>;

/**
 * Administrative Markdown detail response.
 */
export const AdminMarkdown = Markdown;
export type AdminMarkdown = z.infer<typeof AdminMarkdown>;

/**
 * Request body for creating a Markdown document.
 */
export const CreateMarkdown = z.object({
  key: MarkdownKey,
  data: z.string().trim().min(1)
});

export type CreateMarkdown = z.infer<typeof CreateMarkdown>;

/**
 * Request body for updating a Markdown document.
 */
export const UpdateMarkdown = z
  .object({
    key: MarkdownKey.optional(),
    data: z.string().trim().min(1).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update Markdown.'
  });

export type UpdateMarkdown = z.infer<typeof UpdateMarkdown>;
