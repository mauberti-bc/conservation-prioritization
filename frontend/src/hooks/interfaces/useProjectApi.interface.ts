/**
 * Interface representing a project.
 */
import { GetTaskResponse } from './useTaskApi.interface';

/**
 * Interface representing a project.
 */
export interface Project {
  project_id: string;
  name: string;
  description: string;
}

/**
 * Request interface for creating a project.
 */
export interface CreateProjectRequest {
  name: string;
  description: string;
}

/**
 * Response interface for a project.
 */
export interface GetProjectResponse {
  project_id: string;
  name: string;
  description: string;
  tasks?: GetTaskResponse[];
}
