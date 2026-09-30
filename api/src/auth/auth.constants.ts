/**
 * Authentication messages and limits. The wording is copied from the approved
 * prototype so the Admin Panel and the Android app show exactly the same text.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Invalid email or password.',
  deactivated: 'This account is deactivated. Please contact your instructor.',
  emailTaken: 'That email is already registered.',
  signInRequired: 'Please sign in to continue.',
  forbidden: 'You do not have permission to do that.',
  tooManyAttempts: 'Too many attempts. Please wait a minute and try again.',
} as const;

/** The year levels offered on the prototype's register screen. */
export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
export type YearLevel = (typeof YEAR_LEVELS)[number];

/** bcrypt cost factor, as stated in Chapter II. */
export const BCRYPT_ROUNDS = 10;
