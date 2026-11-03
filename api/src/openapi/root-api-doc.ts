export const rootAPIDoc = {
  openapi: '3.0.0',
  info: {
    version: '0.0.0',
    title: 'conservation-prioritization-api',
    description: 'API for the BC Conservation Prioritization Tool',
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
    }
  },
  servers: [
    {
      url: 'http://localhost:5200',
      description: 'local api via docker'
    },
    {
      url: 'https://conservation-tool-api-fa9440-dev.apps.gold.devops.gov.bc.ca',
      description: 'deployed api in dev environment'
    },
    {
      url: 'https://conservation-tool-api-fa9440-test.apps.gold.devops.gov.bc.ca',
      description: 'deployed api in test environment'
    },
    {
      url: 'https://conservation-tool-api-fa9440-prod.apps.gold.devops.gov.bc.ca',
      description: 'deployed api in prod environment'
    }
  ],
  tags: [],
  externalDocs: {
    description: 'Visit GitHub to find out more about this API',
    url: 'https://github.com/bcgov/conservation-prioritization'
  },
  paths: {},
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          "To access the authenticated api routes, a valid JWT token must be present in the 'Authorization' header. The 'Authorization' header value must be of the form: `Bearer xxxxxx.yyyyyyy.zzzzzz`. This security scheme should be used on endpoints that require a request to be authenticated."
      },
      OptionalBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          "To access optionally authenticated api routes, a valid JWT token may optionally be provided in the 'Authorization' header. The 'Authorization' header value must be of the form: `Bearer xxxxxx.yyyyyyy.zzzzzz`. This security scheme should be used on endpoints that do not require a request to be authenticated, but which do return different values based on whether or not the request is authenticated."
      }
    },
    responses: {
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '403': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '404': {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '409': {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '500': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      default: {
        description: 'Unknown Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    },
    schemas: {
      Error: {
        description: 'Error response object',
        required: ['name', 'status', 'message'],
        properties: {
          name: {
            type: 'string'
          },
          status: {
            type: 'number'
          },
          message: {
            type: 'string'
          },
          errors: {
            type: 'array',
            items: {
              anyOf: [
                {
                  type: 'string'
                },
                {
                  type: 'object'
                }
              ]
            }
          }
        }
      }
    }
  }
};
