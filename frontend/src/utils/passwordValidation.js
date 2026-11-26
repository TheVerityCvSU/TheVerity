export function validatePasswordAgainstPolicies(password = '', policies = null) {
  if (!policies) return null;
  const str = String(password || '');
  if (policies.minLength8 && str.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (policies.numbers && !/\d/.test(str)) {
    return 'Password must contain at least one number.';
  }
  if (policies.specialChars && !/[!@#$%^&*(),.?":{}|<>_\-\\[\];'`~+/=]/.test(str)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}
