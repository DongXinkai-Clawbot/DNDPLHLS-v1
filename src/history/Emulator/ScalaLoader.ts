/**
 * @module Emulator
 * @description Logic for parsing Scala (.scl) tuning files.
 */

import { ScalaTuning } from './types';

/**
 * Parses a Scala file content string into a ScalaTuning object.
 * Handles cents (decimal) and ratio (fraction) formats.
 * Ignores comments starting with '!'.
 * 
 * @param content The raw string content of the .scl file.
 * @returns A parsed ScalaTuning object.
 */
export const parseScala = (content: string): ScalaTuning => {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let description = '';
  let count = 0;
  const pitches: number[] = [];
  const rawDataLines: string[] = [];

  // Filter out comments first
  const dataLines = lines.filter(line => !line.startsWith('!'));

  if (dataLines.length < 2) {
    throw new Error('Invalid Scala file: insufficient data');
  }

  description = dataLines[0];
  count = parseInt(dataLines[1], 10);

  if (isNaN(count)) {
    throw new Error('Invalid Scala file: scale count is not a number');
  }

  // Iterate over remaining lines (should be count + maybe octave/terminator?)
  // Scala files define intervals from the root.
  // We collect up to 'count' lines, or until file ends.
  
  for (let i = 2; i < dataLines.length; i++) {
    const line = dataLines[i];
    // Stop if we hit extra metadata or if we have enough notes?
    // Usually Scala files just list the notes.
    // Some might have more lines than count implies if it defines a larger gamut.
    // But typically count is the "period" or "scale size".
    
    // Parse value
    // If it contains '.', it's cents. If not, it's ratio.
    // But some ratios might be integers (e.g. 2 for octave).
    // Scala spec: "If it contains a period, it is cents. Otherwise ratio."
    // BUT: "2" is usually ratio 2/1. "100.0" is cents.
    
    // Split by whitespace to handle potential comments after value on same line?
    const parts = line.split(/\s+/);
    const valueStr = parts[0];
    
    let value = 0;
    
    if (valueStr.includes('.')) {
      // Cents
      value = parseFloat(valueStr);
    } else {
      // Ratio
      if (valueStr.includes('/')) {
        const [num, den] = valueStr.split('/').map(Number);
        value = (1200 * Math.log2(num / den));
      } else {
        // Integer ratio (e.g. 2)
        const num = parseInt(valueStr, 10);
        value = (1200 * Math.log2(num));
      }
    }

    if (!isNaN(value)) {
      pitches.push(value);
      rawDataLines.push(line);
    }
  }

  return {
    description,
    count,
    pitches, // Now stored as CENTS relative to root
    rawLines: rawDataLines
  };
};

/**
 * Converts a pitch value (cents) to a frequency multiplier.
 * @param cents The cents value.
 * @returns The frequency ratio (e.g. 1.5 for 702 cents).
 */
export const centsToRatio = (cents: number): number => {
  return Math.pow(2, cents / 1200);
};
