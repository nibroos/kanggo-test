/**
 * Input sanitisation helpers (policy §2). Applied inside the zod schemas so that
 * every endpoint gets the same treatment and the service layer only ever sees
 * normalised values.
 */

// Control characters are stripped rather than rejected: they are never meaningful
// in a title or an email and are a common copy/paste artefact. Tab, newline and
// carriage return are preserved because task descriptions are multi-line.
const CONTROL_CHARS = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');

export function cleanText(value) {
  if (typeof value !== 'string') return value;
  return value.normalize('NFC').replace(CONTROL_CHARS, '').trim();
}

export function cleanSingleLine(value) {
  if (typeof value !== 'string') return value;
  return cleanText(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanEmail(value) {
  if (typeof value !== 'string') return value;
  return cleanSingleLine(value).toLowerCase();
}

/**
 * Collapses empty strings to null so optional columns stay NULL instead of ''.
 */
export function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}
