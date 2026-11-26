const crypto = require('crypto');

const SCRYPT_PREFIX = 'scrypt$';
const SALT_BYTES = 16;
const KEY_LEN = 64;

/**
 * Hashes a plaintext password using salted scrypt (`scrypt$<saltHex>$<hashHex>`).
 */
function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LEN).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}

function isHashedPassword(stored) {
  return typeof stored === 'string' && stored.startsWith(SCRYPT_PREFIX);
}

/**
 * Constant-time string comparison for legacy plaintext migration checks.
 */
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a password against a stored value (either salted scrypt hash or legacy plaintext).
 * Returns `{ valid: boolean, needsUpgrade: boolean }`.
 */
function verifyPassword(plainPassword, storedPassword) {
  if (typeof plainPassword !== 'string' || typeof storedPassword !== 'string' || !storedPassword) {
    return { valid: false, needsUpgrade: false };
  }

  if (storedPassword === 'google_sso_user') {
    return { valid: false, needsUpgrade: false };
  }

  const trimmedInput = plainPassword.trim();

  if (isHashedPassword(storedPassword)) {
    const parts = storedPassword.split('$');
    if (parts.length !== 3) return { valid: false, needsUpgrade: false };
    const [, salt, hashHex] = parts;
    if (!salt || !hashHex) return { valid: false, needsUpgrade: false };

    try {
      const expectedBuf = Buffer.from(hashHex, 'hex');
      if (expectedBuf.length === 0) return { valid: false, needsUpgrade: false };

      const exactDerived = crypto.scryptSync(plainPassword, salt, expectedBuf.length);
      if (crypto.timingSafeEqual(exactDerived, expectedBuf)) {
        return { valid: true, needsUpgrade: false };
      }
      if (trimmedInput && trimmedInput !== plainPassword) {
        const trimmedDerived = crypto.scryptSync(trimmedInput, salt, expectedBuf.length);
        if (crypto.timingSafeEqual(trimmedDerived, expectedBuf)) {
          return { valid: true, needsUpgrade: false };
        }
      }
    } catch (_) {
      return { valid: false, needsUpgrade: false };
    }
    return { valid: false, needsUpgrade: false };
  }

  // Legacy plaintext stored record — verify safely and flag for lazy scrypt upgrade
  const exactMatch = timingSafeEqualStr(plainPassword, storedPassword);
  const trimmedMatch = Boolean(trimmedInput) && timingSafeEqualStr(trimmedInput, storedPassword);
  if (exactMatch || trimmedMatch) {
    return { valid: true, needsUpgrade: true };
  }
  return { valid: false, needsUpgrade: false };
}

/**
 * Strips sensitive fields (`password`) from user objects returned by API responses.
 */
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const { password: _omitted, ...safe } = user;
  return safe;
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashedPassword,
  sanitizeUser,
};
