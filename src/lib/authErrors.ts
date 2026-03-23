/**
 * Map Supabase Auth error message to form field for inline validation.
 * Returns which field the error relates to (if any) and a user-friendly message.
 */
export type AuthErrorField = "email" | "password" | "confirmPassword" | null;

export interface MappedAuthError {
  field: AuthErrorField;
  message: string;
}

const EMAIL_PATTERNS = [
  /invalid login credentials/i,
  /email not confirmed/i,
  /user already registered/i,
  /invalid email/i,
  /unable to validate email/i,
  /forbidden.*email/i,
  /signup.*email/i,
];

const PASSWORD_PATTERNS = [
  /invalid login credentials/i, // Supabase doesn't distinguish; show at password for login
  /password should be at least/i,
  /password.*too short/i,
  /signup requires a valid password/i,
  /new password should be different/i,
];

/**
 * Map Supabase auth error to field + message. Use in login/signup/forgot-password/reset-password.
 * For login, "Invalid login credentials" is mapped to password (no field leak).
 */
export function mapAuthError(err: { message: string }, context: "login" | "signup" | "forgot" | "reset"): MappedAuthError {
  const msg = err.message;
  if (context === "forgot") {
    const isEmail = EMAIL_PATTERNS.some((p) => p.test(msg));
    return { field: isEmail ? "email" : null, message: msg };
  }
  if (context === "reset") {
    const isPassword = PASSWORD_PATTERNS.some((p) => p.test(msg));
    return { field: isPassword ? "password" : null, message: msg };
  }
  if (context === "login") {
    if (/invalid login credentials/i.test(msg)) return { field: "password", message: msg };
    if (EMAIL_PATTERNS.some((p) => p.test(msg))) return { field: "email", message: msg };
    return { field: null, message: msg };
  }
  // signup
  if (/user already registered/i.test(msg) || /email.*already/i.test(msg)) return { field: "email", message: msg };
  if (EMAIL_PATTERNS.some((p) => p.test(msg))) return { field: "email", message: msg };
  if (PASSWORD_PATTERNS.some((p) => p.test(msg))) return { field: "password", message: msg };
  return { field: null, message: msg };
}
