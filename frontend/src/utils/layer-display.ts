/**
 * Derives the user-facing layer name used when only a stored layer path is available.
 *
 * @param path Layer library path, such as "group/subgroup/Layer_Name".
 * @returns Final path segment for display, or the original path when no segment is available.
 */
export const getLayerDisplayName = (path: string): string => {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
};
