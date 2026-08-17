import { Artifact } from './artifact';
import { TaskRun } from './task-run';
import { TaskRunSolution } from './task-run-solution';

/** Task run with its authoritative artifacts. */
export interface TaskRunWithArtifacts extends TaskRun {
  artifacts: Artifact[];
  solutions: TaskRunSolution[];
}
