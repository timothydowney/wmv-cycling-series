# Quick Start: Token Encryption Implementation

## 5-Minute Overview

**Problem:** OAuth tokens stored in plaintext in SQLite  
**Solution:** Encrypt with AES-256-GCM before storing  
**Time to fix:** 2-3 hours including tests  
**Complexity:** Low (uses Node.js built-in crypto)

## Step-by-Step Implementation

### Step 1: Create Encryption Utility

Create `server/src/encryption.js`:

```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');

/**
 * Encrypt an OAuth token using AES-256-GCM
 * @param {string} token - Raw token string
 * @returns {string} - Formatted as IV:AUTHTAG:CIPHERTEXT (all hex)
 */
function encryptToken(token) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  // Format: IV:AUTHTAG:CIPHERTEXT - easy to parse, stores all components
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an OAuth token
 * @param {string} encryptedData - Formatted as IV:AUTHTAG:CIPHERTEXT
 * @returns {string} - Decrypted token
 */
function decryptToken(encryptedData) {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
  
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = { encryptToken, decryptToken };
```

### Step 2: Generate Encryption Key

```bash
# Run once to generate key
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (64 hex characters)

# Add to server/.env:
TOKEN_ENCRYPTION_KEY=a1b2c3d4e5f6...
```

### Step 3: Update .env.example

Add to `server/.env.example`:
```env
TOKEN_ENCRYPTION_KEY=your-256-bit-hex-key-here
```

### Step 4: Import and Use in index.js

```javascript
// At top of server/src/index.js
const { encryptToken, decryptToken } = require('./encryption');

// When storing tokens (in OAuth callback handler):
const encrypted = {
  access_token: encryptToken(token.access_token),
  refresh_token: encryptToken(token.refresh_token),
  expires_at: token.expires_at,
  scope: token.scope
};
// Store encrypted in database

// When retrieving tokens (before API call to Strava):
const storedTokens = db.prepare('SELECT * FROM participant_tokens WHERE strava_athlete_id = ?').get(athleteId);
const decryptedTokens = {
  access_token: decryptToken(storedTokens.access_token),
  refresh_token: decryptToken(storedTokens.refresh_token),
  expires_at: storedTokens.expires_at
};
// Use decryptedTokens in API calls to Strava
```

### Step 5: Write Tests

Create `server/src/__tests__/encryption.test.js`:

```javascript
const { encryptToken, decryptToken } = require('../encryption');

describe('Token Encryption', () => {
  const testToken = 'a4b945687g8h9i0j1k2l3m4n5o6p7q8r';
  
  it('should encrypt and decrypt tokens correctly', () => {
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(testToken);
  });

  it('should produce different ciphertexts for same token', () => {
    const e1 = encryptToken(testToken);
    const e2 = encryptToken(testToken);
    expect(e1).not.toBe(e2); // Random IV ensures different output
    expect(decryptToken(e1)).toBe(testToken);
    expect(decryptToken(e2)).toBe(testToken);
  });

  it('should fail with corrupted encrypted data', () => {
    const corrupted = 'deadbeef:cafe:babe';
    expect(() => decryptToken(corrupted)).toThrow();
  });

  it('should fail with missing components', () => {
    expect(() => decryptToken('invalid')).toThrow();
  });

  it('should fail if auth tag is tampered with', () => {
    const encrypted = encryptToken(testToken);
    const [iv, authTag, cipher] = encrypted.split(':');
    const tampered = `${iv}:${'0'.repeat(authTag.length)}:${cipher}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
```

### Step 6: Migrate Existing Tokens

If you have existing tokens in database:

```javascript
// Migration script (run once, then delete)
const db = require('better-sqlite3')('./server/data/wmv.db');
const { encryptToken } = require('./server/src/encryption');

const all = db.prepare('SELECT * FROM participant_tokens').all();
for (const row of all) {
  db.prepare(`
    UPDATE participant_tokens 
    SET access_token = ?, refresh_token = ?
    WHERE strava_athlete_id = ?
  `).run(
    encryptToken(row.access_token),
    encryptToken(row.refresh_token),
    row.strava_athlete_id
  );
}

console.log(`Encrypted ${all.length} token records`);
```

### Step 7: Verify

```bash
# Run tests
cd server
npm test -- encryption.test.js

# Verify database (tokens should look like: hex:hex:hex)
sqlite3 data/wmv.db "SELECT strava_athlete_id, access_token FROM participant_tokens LIMIT 1;"
```

## What This Gives You

✅ **Compliant:** OWASP Cryptographic Storage standard  
✅ **Secure:** AES-256-GCM with authenticated encryption  
✅ **Simple:** Uses Node.js built-in crypto, no external dependencies  
✅ **Debuggable:** Encryption/decryption happens in application  
✅ **Testable:** Easy to write comprehensive tests  
✅ **Rotatable:** Can change encryption key (requires re-encrypting all tokens)

## Key Security Properties

- **AES-256:** 256-bit symmetric encryption (industry standard)
- **GCM Mode:** Galois/Counter Mode provides authenticated encryption (detects tampering)
- **Random IV:** Each encryption uses unique initialization vector (prevents patterns)
- **Auth Tag:** Verifies data hasn't been tampered with
- **Key Rotation Capable:** Can update encryption key by re-encrypting all tokens

## Common Questions

**Q: Can we accidentally store plaintext tokens?**
A: Yes, if you forget to call `encryptToken()`. Consider creating a wrapper that validates/enforces encryption.

**Q: What if the encryption key leaks?**
A: Generate new key immediately, re-encrypt all tokens, rotate session secrets. Keep the key in `.env` which is `.gitignored`.

**Q: Does this affect API performance?**
A: Negligible. Encryption/decryption of short tokens is microseconds. You do it rarely (once per user session).

**Q: Can we use a simpler approach?**
A: Hashing is one-way (can't decrypt). For tokens that need to be sent to Strava API, you need encryption (reversible).

## Troubleshooting

**"Invalid encrypted token format"** 
→ Likely the token in database is old plaintext. Run migration script.

**"Unsupported state or unable to authenticate data"**
→ Auth tag validation failed. Token was corrupted or tampered with.

**"Unknown cipher 'aes-256-gcm'"**
→ Node.js version too old. Must be 10+. Use `node --version` to check.

**"TOKEN_ENCRYPTION_KEY is undefined"**
→ Missing in `.env`. Generate with `openssl rand -hex 32` and add to `.env`.

---

**Ready to implement?** Start with Step 1 (create encryption.js), then run Step 7 (verify tests pass). The full implementation is straightforward and low-risk.
