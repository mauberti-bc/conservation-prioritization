import { AxiosInstance } from 'axios';
import { CreateTaskRequest, GetTaskResponse } from 'hooks/interfaces/useTaskApi.interface';
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
  const getAllTasks = async (pagination?: ApiPaginationRequestOptions): Promise<GetTaskResponse[]> => {
    const { data } = await axios.get<GetTaskResponse[]>('/api/task', {
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
    deleteTask,
  };
};
