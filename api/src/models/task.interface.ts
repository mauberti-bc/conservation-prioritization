import { Task } from './task';
import { TaskRunWithArtifacts } from './task-run.interface';

/** Task metadata with its latest immutable optimization problem and results. */
export interface TaskDetails extends Task {
  projects?: {
    project_id: string;
    name: string;
    description: string | null;
    colour: string;
  }[];
  dashboard_id?: string | null;
  latest_run?: TaskRunWithArtifacts | null;
}
