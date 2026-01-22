/**
 * Sanitize server name to create a valid server label
 * Must start with a letter and contain only letters, digits, '-' and '_'
 */
export function sanitizeServerLabel(name: string): string {
  let sanitized = name
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();

  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = 's_' + sanitized;
  }

  return sanitized;
}
