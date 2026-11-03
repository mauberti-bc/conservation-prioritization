import { TaskExport } from './task-export';
import { TaskExportFile } from './task-export-file';

export interface TaskExportWithFiles extends TaskExport {
  files: TaskExportFile[];
}

export interface TaskExportDownload {
  url: string;
  expires_in_seconds: number;
}
