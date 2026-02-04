import { z } from 'zod';

// Profile Model with core fields
export const Profile = z.object({
  profile_id: z.string().uuid(), // UUID type for profile_id
  identity_source: z.string(), // Identity source as string (e.g., 'SYSTEM', 'IDIR', 'DATABASE')
  profile_identifier: z.string().max(200), // Max length of 200 for profile_identifier
  profile_guid: z.string().max(200) // Max length of 200 for profile_guid
});

// Profile Keycloak Model with extended fields
export const ProfileKeycloak = Profile.extend({
  display_name: z.string().nullable(), // Optional display name
  given_name: z.string().nullable(), // Optional given name
  family_name: z.string().nullable(), // Optional family name
  email: z.string().nullable(), // Optional email
  agency: z.string().nullable(), // Optional agency
  notes: z.string().nullable() // Optional notes
});

export type Profile = z.infer<typeof Profile>;
export type ProfileKeycloak = z.infer<typeof ProfileKeycloak>;

export const ProfileExtended = Profile.extend({
  identity_source: z.string(), // Same field as in Profile
  role_ids: z.array(z.number()),
  role_names: z.array(z.string())
});

export type ProfileExtended = z.infer<typeof ProfileExtended>;
