/**
 * Converts a user-entered hex body (with or without leading #) to canonical API format.
 *
 * @param {string | null | undefined} value
 * @return {string | undefined} A #RRGGBB value or undefined when empty.
 */
export const toApiHexColour = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const hexBody = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  return `#${hexBody.toUpperCase()}`;
};

/**
 * Converts API hex values to the form field body value (without leading #).
 *
 * @param {string | null | undefined} value
 * @return {string}
 */
export const toHexBody = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  return value.startsWith('#') ? value.slice(1).toUpperCase() : value.toUpperCase();
};

/**
 * Generates a random hex colour in #RRGGBB format.
 *
 * @return {string}
 */
export const getRandomHex = (): string => {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
};

/**
 * Generates a random hex colour body in RRGGBB format.
 *
 * @return {string}
 */
export const getRandomHexBody = (): string => {
  return getRandomHex().slice(1);
};
