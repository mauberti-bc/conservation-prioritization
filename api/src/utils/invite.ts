/**
 * Normalize and deduplicate email addresses for invite workflows.
 *
 * @param {string[]} emails
 * @returns {string[]} Normalized, unique email addresses.
 */
export const normalizeInviteEmails = (emails: string[]): string[] => {
  const normalized = emails
    .map((email) => email.trim().toLowerCase())
    .filter((email) => Boolean(email));

  return Array.from(new Set(normalized));
};
