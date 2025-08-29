/**
 *
 * @param {string | number} value
 * @returns
 */
export const formatBudget = (value: string | number) => {
  const clean = String(value).replace(/[^0-9.]/g, '');

  if (clean === '') {
    return '';
  }

  const [intPart, decimalPart] = clean.split('.');
  const intFormatted = Number(intPart).toLocaleString('en-US');

  let result = intFormatted;
  if (decimalPart !== undefined) {
    result += '.' + decimalPart.slice(0, 2);
  }

  return result;
};
