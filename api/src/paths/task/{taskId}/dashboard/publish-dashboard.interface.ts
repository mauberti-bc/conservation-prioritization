export interface PublishDashboardBody {
  name: string;
  access_scheme: 'ANYONE_WITH_LINK' | 'MEMBERS_ONLY' | 'NOBODY';
}
