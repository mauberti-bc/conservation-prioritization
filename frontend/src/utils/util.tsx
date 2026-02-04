import { IDENTITY_SOURCE } from 'constants/auth';

/**
 * Checks if a url string starts with an `http[s]://` protocol, and adds `https://` if it does not. If the url
 * begins with `localhost` or `host.docker.internal`, the `http` protocol is used.
 *
 * @param {string} url
 * @param {('http://' | 'https://')} [protocol='https://'] The protocol to add, if necessary. Defaults to `https://`.
 * @return {*}  {string} the url which is guaranteed to have an `http(s)://` protocol.
 */
export const ensureProtocol = (url: string, protocol: 'http://' | 'https://' = 'https://'): string => {
  if (url.startsWith('localhost') || url.startsWith('host.docker.internal')) {
    return `${'http://'}${url}`;
  }

  if (
    url.startsWith('https://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://host.docker.internal')
  ) {
    return url;
  }

  if (url.startsWith('http://')) {
    // If protocol is HTTPS, upgrade the URL
    if (protocol === 'https://') {
      return `${'https://'}${url.slice(7)}`;
    }
  }

  return `${protocol}${url}`;
};

/**
 * Builds a URL from multiple (possibly null or undefined) url parts, stripping any
 * double slashes from the resulting URL.
 *
 * @param {(string | undefined)[]} urlParts The parts of the URL
 * @returns The built URL
 */
export const buildUrl = (...urlParts: (string | undefined)[]): string => {
  return urlParts
    .filter((urlPart): urlPart is string => Boolean(urlPart))
    .map((urlPart) => String(urlPart).trim()) // Trim leading and trailing whitespace
    .filter(Boolean)
    .join('/')
    .replace(/([^:]\/)\/+/g, '$1'); // Trim double slashes
};

/**
 * Converts a string or number into a numeric seed.
 * @param input string | number
 * @returns number
 */
const toSeed = (input: string | number): number => {
  if (typeof input === 'number') {
    return Math.abs(Math.floor(input));
  }

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Generates a random hex color based on a string or number seed.
 *
 * @param {string | number} input
 * @returns {string}
 */
export const getRandomHexColor = (input: string | number): string => {
  let seed = toSeed(input);

  const randomChannel = (min: number, max: number): string => {
    const x = Math.sin(seed++) * 10000;
    return (Math.floor((x - Math.floor(x)) * (max - min + 1)) + min).toString(16).padStart(2, '0');
  };

  const red = randomChannel(100, 190);
  const green = randomChannel(100, 190);
  const blue = randomChannel(120, 200);

  return `#${red}${green}${blue}`;
};

/**
 * Adds a suffix to a word to make it plural based on the count being > 1
 *
 * @param string
 * @param count
 * @param suffix
 * @returns
 */
export const pluralize = (string: string, count: number, suffix: string = 's') => {
  if (count > 1) {
    return `${string}${suffix}`;
  }

  return string;
};

/**
 * Returns a human-readible identity source string.
 *
 * @example getFormattedIdentitySource("IDIR"); // => "IDIR"
 *
 * @param {IDENTITY_SOURCE} identitySource The identity source
 * @returns {*} {string} the string representing the identity source
 */
export const getFormattedIdentitySource = (identitySource: IDENTITY_SOURCE): string | null => {
  switch (identitySource) {
    case IDENTITY_SOURCE.IDIR:
      return 'IDIR';

    default:
      return null;
  }
};
