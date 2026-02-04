import { AxiosInstance } from 'axios';
import { InviteProfilesRequest, InviteProfilesResponse } from 'hooks/interfaces/invite.interface';
import {
  CreateTaskRequest,
  GetTaskResponse,
  GetTasksResponse,
  PublishDashboardRequest,
  PublishDashboardResponse,
  UpdateTaskStatusRequest,
} from 'hooks/interfaces/useTaskApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for task management.
 *
 * @param {AxiosInstance} axios - Axios instance for making HTTP requests.
 * @return {*} Object containing task API methods.
 */
export const useTaskApi = (axios: AxiosInstance) => {
  /**
   * Create a new task.
   *
   * @param {CreateTaskRequest} taskData - Data used to create the task.
   * @return {Promise<GetTaskResponse>} The newly created task with optional layers and constraints.
   */
  const createTask = async (taskData: CreateTaskRequest): Promise<GetTaskResponse> => {
    const { data } = await axios.post<GetTaskResponse>('/api/task', taskData);
    return data;
  };

  /**
   * Retrieve a task by its ID.
   *
   * @param {string} taskId - The UUID of the task to fetch.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters for layers or constraints.
   * @return {Promise<GetTaskResponse>} The task with its associated layers and constraints.
   */
  const getTaskById = async (taskId: string, pagination?: ApiPaginationRequestOptions): Promise<GetTaskResponse> => {
    const { data } = await axios.get<GetTaskResponse>(`/api/task/${taskId}`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
    });
    return data;
  };

  /**
   * Retrieve all tasks.
   *
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters.
   * @return {Promise<GetTaskResponse[]>} A list of tasks.
   */
  const getAllTasks = async (pagination?: ApiPaginationRequestOptions): Promise<GetTasksResponse> => {
    const { data } = await axios.get<GetTasksResponse>('/api/task', {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
    });
    return data;
  };

  /**
   * Update a task by its ID.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {Partial<CreateTaskRequest>} updates - Fields to update for the task.
   * @return {Promise<GetTaskResponse>} The updated task.
   */
  const updateTask = async (taskId: string, updates: Partial<CreateTaskRequest>): Promise<GetTaskResponse> => {
    const { data } = await axios.put<GetTaskResponse>(`/api/task/${taskId}`, updates);
    return data;
  };

  /**
   * Update a task execution status by its ID.
   *
   * @param {string} taskId - The UUID of the task to update.
   * @param {UpdateTaskStatusRequest} updates - Status update payload.
   * @return {Promise<GetTaskResponse>} The updated task.
   */
  const updateTaskStatus = async (taskId: string, updates: UpdateTaskStatusRequest): Promise<GetTaskResponse> => {
    const { data } = await axios.put<GetTaskResponse>(`/api/task/${taskId}/status/`, updates);
    return data;
  };

  /**
   * Publish a task to a new dashboard.
   *
   * @param {string} taskId - The UUID of the task to publish.
   * @param {PublishDashboardRequest} payload - Dashboard publish payload.
   * @return {Promise<PublishDashboardResponse>} The created dashboard response.
   */
  const publishTaskDashboard = async (
    taskId: string,
    payload: PublishDashboardRequest
  ): Promise<PublishDashboardResponse> => {
    const { data } = await axios.post<PublishDashboardResponse>(`/api/task/${taskId}/dashboard`, payload);
    return data;
  };

  /**
   * Add one or more projects to a task.
   *
   * @param {string} taskId - The UUID of the task.
   * @param {string[]} projectIds - Project UUIDs to add.
   * @return {Promise<void>} The created project-task associations.
   */
  const addProjectsToTask = async (taskId: string, projectIds: string[]): Promise<any> => {
    const { data } = await axios.post(`/api/task/${taskId}/project`, { projectIds });
    return data;
  };

  /**
   * Invite profiles to a task by email.
   *
   * @param {string} taskId
   * @param {InviteProfilesRequest} payload
   * @return {Promise<InviteProfilesResponse>}
   */
  const inviteProfilesToTask = async (
    taskId: string,
    payload: InviteProfilesRequest
  ): Promise<InviteProfilesResponse> => {
    const { data } = await axios.post<InviteProfilesResponse>(`/api/task/${taskId}/profile`, payload);
    return data;
  };

  /**
   * Delete a task by its ID.
   *
   * @param {string} taskId - The UUID of the task to delete.
   * @return {Promise<void>} Resolves when the task has been successfully deleted.
   */
  const deleteTask = async (taskId: string): Promise<void> => {
    const { data } = await axios.delete<void>(`/api/task/${taskId}`);
    return data;
  };

  return {
    createTask,
    getTaskById,
    getAllTasks,
    updateTask,
    updateTaskStatus,
    publishTaskDashboard,
    addProjectsToTask,
    inviteProfilesToTask,
    deleteTask,
  };
};
