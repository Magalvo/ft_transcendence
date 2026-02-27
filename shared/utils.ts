/***********************************/
/*                                 */
/*   Some useful methods/objects   */
/*                                 */
/***********************************/

/**
 * Returns a random integer between min and max (inclusive).
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns {number}
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float between min and max, rounded to 2 decimal places.
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns {number}
 */
export function randomFloat2(min: number, max: number): number {
  const num = Math.random() * (max - min) + min;
  return Math.round(num * 100) / 100;
}

/**
 * Normalizes an angle to the interval [-180, 180).
 * Example: 360º + 1 = 1º
 * @param angle - Angle in degrees
 * @returns {number} Normalized angle in the range [-180, 180)
 */
export function normalizeAngle180(angle: number): number {
  return (((angle + 180) % 360) + 360) % 360 - 180;
}

/**
 * Rounds a number to the specified number of decimal places.
 * @param num - The number to be rounded.
 * @param decimalPlaces - The number of decimal places to round to.
 * @returns The rounded number.
 */
export function roundTo(num: number, decimalPlaces: number): number {
  // Create the power factor (e.g., 10^2 = 100 for 2 decimal places)
  const factor = 10 ** decimalPlaces;

  // Multiply, round, and divide to achieve the desired precision
  return Math.round(num * factor) / factor;
}