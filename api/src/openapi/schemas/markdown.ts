import { OpenAPIV3 } from 'openapi-types';

export const MarkdownKeySchema: OpenAPIV3.SchemaObject = {
  type: 'string',
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  example: 'tutorial'
};

export const ApiMarkdownSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['key', 'data'],
  additionalProperties: false,
  properties: {
    key: MarkdownKeySchema,
    data: {
      type: 'string'
    }
  }
};

export const AdminMarkdownListItemSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['markdown_id', 'key', 'preview', 'created_at'],
  additionalProperties: false,
  properties: {
    markdown_id: {
      type: 'string',
      format: 'uuid'
    },
    key: MarkdownKeySchema,
    preview: {
      type: 'string'
    },
    created_at: {
      type: 'string',
      nullable: true
    },
    created_by: {
      type: 'string',
      format: 'uuid',
      nullable: true
    },
    updated_at: {
      type: 'string',
      nullable: true
    },
    updated_by: {
      type: 'string',
      format: 'uuid',
      nullable: true
    }
  }
};

export const AdminMarkdownSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['markdown_id', 'key', 'data', 'created_at'],
  additionalProperties: false,
  properties: {
    ...AdminMarkdownListItemSchema.properties,
    data: {
      type: 'string'
    }
  }
};

export const MarkdownWriteSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['key', 'data'],
  additionalProperties: false,
  properties: {
    key: MarkdownKeySchema,
    data: {
      type: 'string',
      minLength: 1
    }
  }
};

export const MarkdownPatchSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    key: MarkdownKeySchema,
    data: {
      type: 'string',
      minLength: 1
    }
  }
};
