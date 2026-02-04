export interface InviteProfilesRequest {
  emails: string[];
}

export interface InviteProfilesResponse {
  added_profile_ids: string[];
  skipped_emails: string[];
}
