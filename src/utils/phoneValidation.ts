/**
 * Validates Bangladeshi phone numbers
 * Supports formats:
 * - +880 1XXX-XXXXXX
 * - 880 1XXX-XXXXXX
 * - 01XXXXXXXXX (11 digits)
 * - Common prefixes: 017, 018, 019, 015, 016, 013, 014
 */
export const validateBangladeshiPhone = (phone: string): boolean => {
  if (!phone) return false;

  // Remove all spaces, dashes, and plus signs for validation
  const cleaned = phone.replace(/[\s\-+]/g, "");

  // Check if it starts with 880 (country code)
  // Format: 8801XXXXXXXXX (13 digits total, where 1XXXXXXXXX is 10 digits)
  if (cleaned.startsWith("880")) {
    const phoneWithoutCountryCode = cleaned.substring(3);
    if (phoneWithoutCountryCode.length === 10 && phoneWithoutCountryCode.startsWith("1")) {
      // Check if it's a valid mobile prefix (1XX where second digit is 3-9)
      const secondDigit = phoneWithoutCountryCode.charAt(1);
      const validSecondDigits = ["3", "4", "5", "6", "7", "8", "9"];
      return validSecondDigits.includes(secondDigit);
    }
    return false;
  }

  // Check if it starts with 01 (local format)
  // Format: 01XXXXXXXXX (11 digits total)
  if (cleaned.startsWith("01")) {
    if (cleaned.length === 11) {
      // Check if it's a valid mobile prefix (01X where X is 3-9)
      const thirdDigit = cleaned.charAt(2);
      const validThirdDigits = ["3", "4", "5", "6", "7", "8", "9"];
      return validThirdDigits.includes(thirdDigit);
    }
    return false;
  }

  return false;
};

/**
 * Normalizes Bangladeshi phone number to a standard format
 * Returns: +8801XXXXXXXXX
 */
export const normalizeBangladeshiPhone = (phone: string): string => {
  if (!phone) return "";

  // Remove all spaces, dashes, and plus signs
  const cleaned = phone.replace(/[\s\-+]/g, "");

  // If it starts with 880, format as +8801XXXXXXXXX
  if (cleaned.startsWith("880")) {
    const numberPart = cleaned.substring(3); // Get the 10 digits after 880
    return `+880${numberPart}`;
  }

  // If it starts with 01, convert to +880 format (remove leading 0, add +880)
  if (cleaned.startsWith("01")) {
    const numberPart = cleaned.substring(1); // Remove the leading 0 to get 1XXXXXXXXX
    return `+880${numberPart}`;
  }

  return phone;
};

/**
 * Checks if a string is a valid email address
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Determines if the input is an email or phone number
 */
export const isEmail = (input: string): boolean => {
  return isValidEmail(input);
};

export const isPhone = (input: string): boolean => {
  return validateBangladeshiPhone(input);
};
