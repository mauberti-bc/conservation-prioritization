import { GetTaskResponse } from './useTaskApi.interface';

/**
 * Interface representing a project.
 */
export interface Project {
  project_id: string;
  name: string;
  description: string;
  colour: string;
}

/**
 * Request interface for creating a project.
 */
export interface CreateProjectRequest {
  name: string;
  description: string;
  colour?: string;
}

/**
 * Response interface for a project.
 */
export interface GetProjectResponse {
  project_id: string;
  name: string;
  description: string;
  colour: string;
  tasks?: GetTaskResponse[];
  task_count?: number;
}
