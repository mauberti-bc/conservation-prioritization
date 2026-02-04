import { AxiosInstance } from 'axios';
import { CreateProjectRequest, GetProjectResponse } from 'hooks/interfaces/useProjectApi.interface';
import { GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for project management.
 *
 * @param {AxiosInstance} axios - Axios instance for making HTTP requests.
 * @return {*} Object containing project API methods.
 */
export const useProjectApi = (axios: AxiosInstance) => {
  /**
   * Create a new project.
   *
   * @param {CreateProjectRequest} projectData - Data used to create the project.
   * @return {Promise<GetProjectResponse>} The newly created project with optional layers and constraints.
   */
  const createProject = async (projectData: CreateProjectRequest): Promise<GetProjectResponse> => {
    const { data } = await axios.post<GetProjectResponse>('/api/project', projectData);
    return data;
  };

  /**
   * Retrieve a project by its ID.
   *
   * @param {string} projectId - The UUID of the project to fetch.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters for layers or constraints.
   * @return {Promise<GetProjectResponse>} The project with its associated layers and constraints.
   */
  const getProjectById = async (
    projectId: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<GetProjectResponse> => {
    const { data } = await axios.get<GetProjectResponse>(`/api/project/${projectId}`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
    });
    return data;
  };

  /**
   * Retrieve all projects.
   *
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters.
   * @return {Promise<GetProjectResponse[]>} A list of projects.
   */
  const getAllProjects = async (pagination?: ApiPaginationRequestOptions): Promise<GetProjectResponse[]> => {
    const { data } = await axios.get<GetProjectResponse[]>('/api/project', {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
    });
    return data;
  };

  /**
   * Add one or more tasks to a project.
   *
   * @param {string} projectId - The project UUID.
   * @param {string[]} taskIds - Task UUIDs to attach to the project.
   * @return {Promise<void>} Resolves when the tasks are added.
   */
  const addTasksToProject = async (projectId: string, taskIds: string[]): Promise<void> => {
    await axios.post(`/api/project/${projectId}/task`, { taskIds });
  };

  /**
   * Retrieve tasks associated with a project.
   *
   * @param {string} projectId - The project UUID.
   * @return {Promise<GetTaskResponse[]>} A list of tasks.
   */
  const getProjectTasks = async (projectId: string): Promise<GetTaskResponse[]> => {
    const { data } = await axios.get<GetTaskResponse[]>(`/api/project/${projectId}/task`);
    return data;
  };

  /**
   * Update a project by its ID.
   *
   * @param {string} projectId - The UUID of the project to update.
   * @param {Partial<CreateProjectRequest>} updates - Fields to update for the project.
   * @return {Promise<GetProjectResponse>} The updated project.
   */
  const updateProject = async (
    projectId: string,
    updates: Partial<CreateProjectRequest>
  ): Promise<GetProjectResponse> => {
    const { data } = await axios.put<GetProjectResponse>(`/api/project/${projectId}`, updates);
    return data;
  };

  /**
   * Delete a project by its ID.
   *
   * @param {string} projectId - The UUID of the project to delete.
   * @return {Promise<void>} Resolves when the project has been successfully deleted.
   */
  const deleteProject = async (projectId: string): Promise<void> => {
    const { data } = await axios.delete<void>(`/api/project/${projectId}`);
    return data;
  };

  return {
    createProject,
    getProjectById,
    getAllProjects,
    updateProject,
    deleteProject,
    addTasksToProject,
    getProjectTasks,
  };
};
