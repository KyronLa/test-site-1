import DOMPurify from 'dompurify';

/**
 * Sanitizes a string using DOMPurify and checks for malicious patterns.
 * @param input The string to sanitize.
 * @returns The sanitized string.
 * @throws Error if the input contains rejected patterns.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;

  // 1. Check for rejected patterns
  const rejectedPatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gim, // Script tags
    /\b(SELECT|DROP|INSERT|UPDATE|DELETE|UNION|TRUNCATE)\b/gim, // SQL-like
    /--|;|--\s*$/g, // SQL comments/separators
    /\b(==|!=|<|<=|>|>=|array-contains|in|not-in|array-contains-any)\b/g // Firestore operators
  ];

  for (const pattern of rejectedPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid input detected: Malicious patterns are not allowed.');
    }
  }

  // 2. DOMPurify sanitization
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed for general text fields
    ALLOWED_ATTR: []
  });
}

/**
 * Recursively sanitizes an object or array.
 */
export function sanitizeData<T>(data: T): T {
  if (typeof data === 'string') {
    return sanitizeInput(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)) as unknown as T;
  }

  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData((data as any)[key]);
      }
    }
    return sanitized as T;
  }

  return data;
}
