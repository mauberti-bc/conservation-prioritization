import { Artifact } from './artifact';
import { TaskExportWithFiles } from './task-export.interface';
import { TaskRun } from './task-run';
import { TaskRunSolution } from './task-run-solution';

/** Task run with its authoritative artifacts. */
export interface TaskRunWithArtifacts extends TaskRun {
  artifacts: Artifact[];
  exports: TaskExportWithFiles[];
  solutions: TaskRunSolution[];
}
