/**
 * Generate a deterministic hex colour from a string seed.
 *
 * @param {string} seed
 * @return {*}  {string}
 */
export const generateHexColourFromSeed = (seed: string): string => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const toChannel = (offset: number, min: number, max: number): string => {
    const value = Math.abs((hash >> offset) & 0xff);
    const scaled = min + (value % (max - min + 1));
    return scaled.toString(16).padStart(2, '0');
  };

  const red = toChannel(0, 90, 190);
  const green = toChannel(8, 90, 190);
  const blue = toChannel(16, 110, 210);

  return `#${red}${green}${blue}`;
};
