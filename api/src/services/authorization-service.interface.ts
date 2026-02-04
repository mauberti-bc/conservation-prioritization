import { SYSTEM_ROLE } from '../constants/roles';

export enum PROJECT_ROLE {
  PROJECT_ADMIN = 'admin',
  PROJECT_USER = 'member'
}

export enum TASK_ROLE {
  TASK_ADMIN = 'admin',
  TASK_USER = 'member'
}

enum AuthorizeOperator {
  AND = 'and',
  OR = 'or'
}

// Add a new interface for the `Profile` discriminator
export interface AuthorizeByProfile {
  validSystemRoles?: SYSTEM_ROLE[];
  discriminator: 'Profile';
}

export interface AuthorizeByTask {
  taskId: string;
  validTaskRoles?: TASK_ROLE[];
  discriminator: 'Task';
}

export interface AuthorizeByProject {
  projectId: string;
  validProjectRoles?: PROJECT_ROLE[];
  discriminator: 'Project';
}

export type AuthorizeRule = AuthorizeByProfile | AuthorizeByTask | AuthorizeByProject;

export type AuthorizeConfigOr = {
  [AuthorizeOperator.AND]?: never;
  [AuthorizeOperator.OR]: AuthorizeRule[];
};

export type AuthorizeConfigAnd = {
  [AuthorizeOperator.AND]: AuthorizeRule[];
  [AuthorizeOperator.OR]?: never;
};

export type AuthorizationScheme = AuthorizeConfigAnd | AuthorizeConfigOr;
