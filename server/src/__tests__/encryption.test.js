// Set encryption key for tests BEFORE requiring encryption module
// Must be 64 hex characters = 32 bytes
process.env.TOKEN_ENCRYPTION_KEY = 'cd03cad3a1b937e9fcf6b25967f70c992d9d7b30e336c7edd7023827e605ee25';

const { encryptToken, decryptToken } = require('../encryption');

describe('Token Encryption', () => {
  const testToken = 'a4b945687g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z';
  const realStravToken = 'a4b945687a80ed2aacc06a91cd49bd9c8e5123fc'; // Format from Strava

  describe('encryptToken()', () => {
    it('should encrypt a token successfully', () => {
      const encrypted = encryptToken(testToken);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      // Format should be IV:AUTHTAG:CIPHERTEXT (all hex)
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0]).toMatch(/^[a-f0-9]{32}$/); // IV (16 bytes = 32 hex chars)
      expect(parts[1]).toMatch(/^[a-f0-9]{32}$/); // AUTHTAG (16 bytes = 32 hex chars)
      expect(parts[2].length).toBeGreaterThan(0); // CIPHERTEXT
    });

    it('should encrypt real Strava token format', () => {
      const encrypted = encryptToken(realStravToken);
      expect(encrypted).toBeDefined();
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
    });

    it('should produce different ciphertexts for the same token (random IV)', () => {
      const e1 = encryptToken(testToken);
      const e2 = encryptToken(testToken);
      expect(e1).not.toBe(e2);
      // But both should decrypt to same token
      expect(decryptToken(e1)).toBe(testToken);
      expect(decryptToken(e2)).toBe(testToken);
    });

    it('should handle empty strings', () => {
      const encrypted = encryptToken('');
      expect(encrypted).toBeDefined();
      expect(decryptToken(encrypted)).toBe('');
    });

    it('should handle very long tokens', () => {
      const longToken = 'x'.repeat(10000);
      const encrypted = encryptToken(longToken);
      expect(decryptToken(encrypted)).toBe(longToken);
    });

    it('should handle special characters', () => {
      const specialToken = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = encryptToken(specialToken);
      expect(decryptToken(encrypted)).toBe(specialToken);
    });

    it('should handle unicode characters', () => {
      const unicodeToken = 'token_émoji_🔐_中文';
      const encrypted = encryptToken(unicodeToken);
      expect(decryptToken(encrypted)).toBe(unicodeToken);
    });
  });

  describe('decryptToken()', () => {
    it('should decrypt a valid encrypted token', () => {
      const encrypted = encryptToken(testToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(testToken);
    });

    it('should fail with invalid format (missing colons)', () => {
      expect(() => decryptToken('invalidformat')).toThrow();
      expect(() => decryptToken('only:two')).toThrow();
    });

    it('should fail with corrupted IV', () => {
      const encrypted = encryptToken(testToken);
      const [, authTag, cipher] = encrypted.split(':');
      const corrupted = `${'0'.repeat(32)}:${authTag}:${cipher}`;
      expect(() => decryptToken(corrupted)).toThrow();
    });

    it('should fail with corrupted auth tag (tamper detection)', () => {
      const encrypted = encryptToken(testToken);
      const [iv, , cipher] = encrypted.split(':');
      const tampered = `${iv}:${'0'.repeat(32)}:${cipher}`;
      expect(() => decryptToken(tampered)).toThrow('Unsupported state or unable to authenticate data');
    });

    it('should fail with corrupted ciphertext', () => {
      const encrypted = encryptToken(testToken);
      const [iv, authTag] = encrypted.split(':');
      const corrupted = `${iv}:${authTag}:${'0'.repeat(100)}`;
      expect(() => decryptToken(corrupted)).toThrow();
    });

    it('should fail with null input', () => {
      expect(() => decryptToken(null)).toThrow();
    });

    it('should fail with undefined input', () => {
      expect(() => decryptToken(undefined)).toThrow();
    });
  });

  describe('Encrypt/Decrypt Round Trip', () => {
    const testCases = [
      'simple_token',
      'token_with_numbers_123456789',
      'a4b945687g8h9i0j1k2l3m4n5o6p7q8r',
      '',
      'x'.repeat(1000),
      '!@#$%^&*()',
    ];

    testCases.forEach((token) => {
      it(`should round-trip correctly for: ${token.substring(0, 20)}${token.length > 20 ? '...' : ''}`, () => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });
  });

  describe('Security Properties', () => {
    it('should use random IV (different ciphertexts for same plaintext)', () => {
      const token = testToken;
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);
      
      // Get IVs from encrypted data
      const [iv1] = encrypted1.split(':');
      const [iv2] = encrypted2.split(':');
      
      // IVs should be different (random)
      expect(iv1).not.toBe(iv2);
      
      // But both decrypt to same value
      expect(decryptToken(encrypted1)).toBe(token);
      expect(decryptToken(encrypted2)).toBe(token);
    });

    it('should detect any bit of tampering (authentication tag)', () => {
      const encrypted = encryptToken(testToken);
      const [iv, authTag, cipher] = encrypted.split(':');
      
      // Tamper with a single hex character in ciphertext
      const tamperedCipher = cipher.substring(0, cipher.length - 1) + (cipher[cipher.length - 1] === '0' ? '1' : '0');
      const tampered = `${iv}:${authTag}:${tamperedCipher}`;
      
      // Should detect tampering
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('should format as hexadecimal (safe for database storage)', () => {
      const encrypted = encryptToken(testToken);
      // Check that it's all hex digits and colons
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe('Production Scenarios', () => {
    it('should handle refresh token encryption (long-lived token)', () => {
      // Strava refresh tokens are typically 40+ character hex strings
      const refreshToken = 'e5n567567a3b6c8e1f3a5d7f9b1c3e5a7f9b1c3e';
      const encrypted = encryptToken(refreshToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(refreshToken);
    });

    it('should handle access token encryption (short-lived token)', () => {
      // Strava access tokens are typically 40 character hex strings
      const accessToken = 'a4b945687a80ed2aacc06a91cd49bd9c8e5123fc';
      const encrypted = encryptToken(accessToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(accessToken);
    });

    it('should handle multiple sequential encryptions (database operations)', () => {
      // Simulate multiple token operations
      const tokens = [
        'token_1_a4b945687g8h9i0j1k2l3m4n5o6p7q8r',
        'token_2_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j',
        'token_3_abcdefghijklmnopqrstuvwxyz123456',
      ];

      const encrypted = tokens.map(t => encryptToken(t));
      const decrypted = encrypted.map(e => decryptToken(e));

      expect(decrypted).toEqual(tokens);
    });
  });
});
