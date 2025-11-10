const crypto = require('crypto');

/**
 * Get encryption key from environment
 * This is a function so it can be re-read in tests
 */
function getEncryptionKey() {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable not set. Cannot encrypt tokens.');
  }
  return Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt an OAuth token using AES-256-GCM
 * @param {string} token - Raw token string to encrypt
 * @returns {string} - Encrypted token in format: IV:AUTHTAG:CIPHERTEXT (all hex)
 * @throws {Error} if TOKEN_ENCRYPTION_KEY not set
 */
function encryptToken(token) {
  const ENCRYPTION_KEY = getEncryptionKey();

  // Generate random IV for this encryption
  const iv = crypto.randomBytes(16);
  
  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  // Encrypt the token
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag (ensures data hasn't been tampered with)
  const authTag = cipher.getAuthTag();
  
  // Format: IV:AUTHTAG:CIPHERTEXT (all hex, easy to parse and store)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an OAuth token
 * @param {string} encryptedData - Encrypted token in format: IV:AUTHTAG:CIPHERTEXT
 * @returns {string} - Decrypted token
 * @throws {Error} if decryption fails (corrupted data or tampered)
 */
function decryptToken(encryptedData) {
  const ENCRYPTION_KEY = getEncryptionKey();

  // Parse the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format. Expected IV:AUTHTAG:CIPHERTEXT');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  try {
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher with same algorithm and key
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    // Set the authentication tag for verification
    decipher.setAuthTag(authTag);
    
    // Decrypt the token
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // setAuthTag or final() will throw if data was tampered with
    throw new Error(`Token decryption failed. Data may be corrupted or tampered: ${error.message}`);
  }
}

module.exports = {
  encryptToken,
  decryptToken,
};
