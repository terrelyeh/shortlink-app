import { customAlphabet } from "nanoid";

// Base62 alphabet (a-z, A-Z, 0-9)
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Generate a random short code
const generateCode = customAlphabet(ALPHABET, 7);

export function createShortCode(): string {
  return generateCode();
}

// Validate custom code format
export function isValidCustomCode(code: string): boolean {
  // Allow alphanumeric, hyphens, and underscores
  // Length between 3 and 50 characters
  const pattern = /^[a-zA-Z0-9_-]{3,50}$/;
  return pattern.test(code);
}

// Reserved codes that cannot be used
const RESERVED_CODES = [
  "api",
  "auth",
  "admin",
  "dashboard",
  "links",
  "settings",
  "analytics",
  "templates",
  "users",
  "health",
  "status",
  "404",
  "500",
  "error",
];

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.includes(code.toLowerCase());
}
