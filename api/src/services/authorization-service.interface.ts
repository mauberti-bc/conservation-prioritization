export enum SYSTEM_ROLE {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  SYSTEM_USER = 'SYSTEM_USER'
}

export enum PROJECT_ROLE {
  PROJECT_ADMIN = 'PROJECT_ADMIN',
  PROJECT_USER = 'PROJECT_USER'
}

export enum TASK_ROLE {
  TASK_ADMIN = 'TASK_ADMIN',
  TASK_USER = 'TASK_USER'
}

enum AuthorizeOperator {
  AND = 'and',
  OR = 'or'
}

// Add a new interface for the `SystemRole` discriminator
export interface AuthorizeBySystemRole {
  validSystemRoles: SYSTEM_ROLE[];
  discriminator: 'SystemRole';
}

export interface AuthorizeByTask {
  taskId: string;
  validTaskRoles: TASK_ROLE[];
  discriminator: 'Task';
}

export interface AuthorizeByProject {
  projectId: string;
  validProjectRoles: PROJECT_ROLE[];
  discriminator: 'Project';
}

export type AuthorizeRule = AuthorizeBySystemRole | AuthorizeByTask | AuthorizeByProject;

export type AuthorizeConfigOr = {
  [AuthorizeOperator.AND]?: never;
  [AuthorizeOperator.OR]: AuthorizeRule[];
};

export type AuthorizeConfigAnd = {
  [AuthorizeOperator.AND]: AuthorizeRule[];
  [AuthorizeOperator.OR]?: never;
};

export type AuthorizationScheme = AuthorizeConfigAnd | AuthorizeConfigOr;
