import { OpenAPIV3 } from 'openapi-types';
import { ProfileWithRoles } from '../models/system-user-view';
import { AuthorizationScheme } from '../services/authorization-service';
import { KeycloakUserInformation } from '../utils/keycloak-utils';

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Multer transformed files.
     */
    files?: Express.Multer.File[];

    /**
     * Keycloak user JWT token object.
     */
    keycloak_token?: KeycloakUserInformation;

    /**
     * SIMS system user details object.
     */
    profile?: ProfileWithRoles;

    /**
     * Authorization Scheme object.
     */
    authorization_scheme?: AuthorizationScheme;

    /**
     * OpenAPI operation object injected by express-openapi.
     * Allows `x-express-openapi-validation-strict` and other extensions.
     */
    apiDoc?: OpenAPIV3.OperationObject & {
      'x-express-openapi-validation-strict'?: boolean;
    };
  }

  interface Response {
    /**
     * OpenAPI Response validation function injected by express-openapi
     */
    validateResponse?: (statusCode: number, responseBody: any) => { message: any; errors: any[] } | undefined;
  }
}
