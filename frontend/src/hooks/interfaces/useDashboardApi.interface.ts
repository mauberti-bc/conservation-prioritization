export type DashboardAccessScheme = 'ANYONE_WITH_LINK' | 'MEMBERS_ONLY' | 'NOBODY';

export interface DashboardResponse {
  dashboard_id: string;
  public_id: string;
  name: string;
  description?: string | null;
  access_scheme: DashboardAccessScheme;
  created_at?: string | null;
  created_by?: string | null;
  task_ids: string[];
  dashboard_url?: string;
}
