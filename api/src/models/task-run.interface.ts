import { Artifact } from './artifact';
import { TaskExportWithFiles } from './task-export.interface';
import { TaskRun } from './task-run';
import { TaskRunArea } from './task-run-area';
import { TaskRunSolution } from './task-run-solution';

/**
 * Task run with its authoritative artifacts.
 */
export interface TaskRunWithArtifacts extends TaskRun {
  areas: TaskRunArea[];
  artifacts: Artifact[];
  exports: TaskExportWithFiles[];
  solutions: TaskRunSolution[];
}
