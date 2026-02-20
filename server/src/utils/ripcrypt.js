/**
 * ripcrypt.js - Password Hashing Utility
 * ใช้ PBKDF2-SHA256 with 200,000 iterations
 * Format: pbkdf2_sha256$iterations$salt$hash
 * 
 * จากโค้ดเดิม - ไม่มีการแก้ไข
 */

const crypto = require('crypto');

/**
 * Generate a random salt
 * @param {number} length - Length of salt in bytes (default 16)
 * @returns {string} Base64 encoded salt
 */
function gensalt(length = 16) {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Hash a password using PBKDF2
 * @param {string|Buffer} password - Password to hash
 * @param {string} salt - Salt (base64 encoded)
 * @param {number} iterations - Number of iterations (default 200,000)
 * @param {number} dklen - Derived key length (default 32)
 * @returns {string} Formatted hash string
 */
function hashpw(password, salt, iterations = 200000, dklen = 32) {
  if (typeof password === 'string') {
    password = Buffer.from(password, 'utf-8');
  }

  const saltBytes = Buffer.from(salt, 'base64');
  const dk = crypto.pbkdf2Sync(password, saltBytes, iterations, dklen, 'sha256');

  return `pbkdf2_sha256$${iterations}$${salt}$${dk.toString('base64')}`;
}

/**
 * Verify a password against a stored hash
 * @param {string|Buffer} password - Password to check
 * @param {string} stored - Stored hash string
 * @returns {boolean} True if password matches
 */
function checkpw(password, stored) {
  try {
    const [algo, iterStr, salt, hashB64] = stored.split('$');
    
    if (algo !== 'pbkdf2_sha256') {
      return false;
    }

    const iterations = parseInt(iterStr, 10);
    const expected = Buffer.from(hashB64, 'base64');

    if (typeof password === 'string') {
      password = Buffer.from(password, 'utf-8');
    }

    const saltBytes = Buffer.from(salt, 'base64');
    const candidate = crypto.pbkdf2Sync(
      password,
      saltBytes,
      iterations,
      expected.length,
      'sha256'
    );

    // Timing-safe comparison
    return crypto.timingSafeEqual(candidate, expected);
  } catch (error) {
    console.error('Error checking password:', error.message);
    return false;
  }
}

module.exports = {
  gensalt,
  hashpw,
  checkpw
};
