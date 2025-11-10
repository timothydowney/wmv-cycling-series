# Security Audit Report

**Date:** November 2025  
**Status:** Pre-Production Review  
**Recommendation:** CRITICAL token encryption issue identified before first production deployment

---

## Executive Summary

This security audit evaluates the Strava NCC Scrape application's handling of sensitive data, particularly OAuth tokens. While the application demonstrates good foundational security practices (credentials NOT in git, `.env` properly protected, reasonable scope management), **one critical vulnerability exists that must be addressed before production deployment**: **OAuth tokens are stored in plaintext in SQLite database**.

**Key Finding:** Strava OAuth access tokens and refresh tokens are stored as unencrypted TEXT in the `participant_tokens` table. This violates OWASP and industry best practices for sensitive token storage.

---

## Current State Assessment

### ✅ What's Working Well

1. **Credentials Protected from Git** 
   - `server/.env` is properly gitignored and verified never committed
   - `.env.example` provides safe template
   - Verified via full git history analysis

2. **Environment Secrets Management**
   - `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` stored in `.env` (not in code)
   - `SESSION_SECRET` in environment
   - `.gitignore` has comprehensive rules protecting `.env`, `*.db`, credentials

3. **OAuth Scope Management**
   - Per-participant scopes tracked (per Strava recommendation)
   - Minimal scope principle: only `activity:read`, `read` (appropriate for leaderboard)
   - 6-hour token expiry (per Strava OAuth design)

4. **Development Setup**
   - Local development uses in-memory session storage
   - No production secrets leaked in code
   - Clear separation between dev and production paths

### ⚠️ Issues Identified

#### CRITICAL: Plaintext Token Storage

**Vulnerability:** OAuth access tokens and refresh tokens stored unencrypted in SQLite database

**Current Schema:**
```sql
CREATE TABLE participant_tokens (
  strava_athlete_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,           -- PLAINTEXT ❌
  refresh_token TEXT NOT NULL,          -- PLAINTEXT ❌
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (strava_athlete_id) REFERENCES participants(strava_athlete_id) ON DELETE CASCADE
);
```

**Attack Scenarios:**
1. **Database File Theft:** If `server/data/wmv.db` is stolen/backed up unencrypted, attacker gains all tokens
2. **Server Compromise:** Remote attacker gains database access via SQL injection → all tokens compromised
3. **Unencrypted Backup:** Database backups are readable
4. **Filesystem Access:** Any process on the server with filesystem read access can read tokens

**Impact:**
- **HIGH:** Token compromise allows attacker to impersonate users to Strava API
- **HIGH:** Access to user activity data, personal information
- **MEDIUM:** Potential for activity tampering if scope expanded to `activity:write`
- **LOW:** Current app functionality would not be compromised (attacker just gains duplicate access)

**OWASP & Industry Standards:**
- OWASP Cryptographic Storage Cheat Sheet: Sensitive data must be encrypted
- OWASP OAuth2 Cheat Sheet: "tokens should be restricted to minimum required scope"
- Strava Developer Docs: "Never share access tokens or refresh tokens in public forums"
- Industry standard: OAuth tokens treated as equivalent to passwords

---

## Recommendations

### Priority 1: Token Encryption (MUST DO BEFORE PRODUCTION)

Implement application-layer encryption for tokens stored in database.

**Approach:** AES-256-GCM encryption with stored encryption key

#### Implementation Steps

1. **Add encryption library to backend:**
   ```bash
   cd server
   npm install crypto-js  # Or use Node.js built-in crypto
   ```

2. **Create encryption utility** (`server/src/encryption.js`):
   ```javascript
   const crypto = require('crypto');
   
   // Use a stored encryption key (see storage below)
   const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
   
   function encryptToken(token) {
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
     
     let encrypted = cipher.update(token, 'utf8', 'hex');
     encrypted += cipher.final('hex');
     
     const authTag = cipher.getAuthTag();
     const encryptedData = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
     
     return encryptedData;
   }
   
   function decryptToken(encryptedData) {
     const [iv, authTag, encrypted] = encryptedData.split(':');
     const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
     decipher.setAuthTag(Buffer.from(authTag, 'hex'));
     
     let decrypted = decipher.update(encrypted, 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     
     return decrypted;
   }
   
   module.exports = { encryptToken, decryptToken };
   ```

3. **Encrypt/decrypt at database boundaries:**
   - Encrypt tokens BEFORE inserting into DB
   - Decrypt tokens AFTER retrieving from DB
   - Keep plaintext only in memory during use

4. **Encryption Key Management:**
   - Generate key: `openssl rand -hex 32` → 64-character hex string
   - Store in `server/.env`: `TOKEN_ENCRYPTION_KEY=<key>`
   - Add to `.env.example`: `TOKEN_ENCRYPTION_KEY=your-256-bit-hex-key-here`
   - **Never** commit the real key

5. **Database Migration:**
   - Create new encrypted columns or migrate in-place
   - Re-encrypt all existing tokens
   - Test thoroughly with existing participant data

**Advantages:**
- Simple implementation using Node.js built-in crypto
- Tokens encrypted in database but accessible to app
- AES-256-GCM provides authenticated encryption (detects tampering)
- Key stored separately in environment

### Priority 2: Enhanced Key Management (SHOULD DO FOR PRODUCTION)

For production Railway deployment, use cloud-based secrets management:

**Option A: Railway Environment Variables (Recommended)**
- Railway provides encrypted environment variable storage
- Automatically rotates and backs up
- No additional cost
- Implementation: Same code, just use Railway's secrets management UI

**Option B: HashiCorp Vault or AWS Secrets Manager (Enterprise)**
- External secrets management
- Centralized key rotation
- Audit logging
- Higher complexity, not needed for current scale

### Priority 3: Session Storage (SHOULD DO FOR PRODUCTION)

Current development uses in-memory sessions (`express-session` with memory store). For production:

**Replace with:**
- **Redis:** Fast, distributed, automatic expiry
- **PostgreSQL:** Persistent, integrated with deployment
- **SQLite (current approach):** Store sessions in separate table from tokens

**Implementation for SQLite:**
```bash
npm install connect-sqlite3
```

```javascript
const SQLiteStore = require('connect-sqlite3')(session);
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true,  // HTTPS only
    httpOnly: true, // No JavaScript access
    sameSite: 'strict', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### Priority 4: Additional Security Hardening

#### A. HTTPS Enforcement (Production Required)
```javascript
// Add before routes
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

#### B. Security Headers
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

#### C. Rate Limiting on OAuth Endpoints
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 requests per window
});

app.get('/oauth/authorize', oauthLimiter, (req, res) => { /* ... */ });
```

#### D. Token Refresh Security
- Implement refresh token rotation (get new refresh token with each use)
- Store previous token for grace period (handles race conditions)
- Invalidate refresh tokens on logout
- Implement token revocation endpoint

---

## Development vs Production Checklist

| Item | Development | Production | Notes |
|------|-------------|-----------|-------|
| Token Encryption | Optional | **REQUIRED** | Use AES-256-GCM |
| Encryption Key Storage | Can be in `.env` | Must use secrets manager | Railway env vars or Vault |
| Session Storage | In-memory | Persistent DB/Redis | SQL or Redis session store |
| HTTPS | Not required | **REQUIRED** | Automatic on Railway |
| Security Headers | Optional | **REQUIRED** | Use Helmet |
| Rate Limiting | Optional | **RECOMMENDED** | Especially on OAuth endpoints |
| CORS Configuration | Localhost only | REQUIRED | Update for production domain |
| Log Monitoring | Console logs | **REQUIRED** | Implement audit logging |

---

## Testing Recommendations

### Unit Tests for Encryption
```javascript
const { encryptToken, decryptToken } = require('../encryption');

describe('Token Encryption', () => {
  it('should encrypt and decrypt tokens correctly', () => {
    const token = 'a4b945687g...'; // Real token format
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/); // IV:Tag:Encrypted
    
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it('should produce different ciphertexts for same token (due to random IV)', () => {
    const token = 'a4b945687g...';
    const e1 = encryptToken(token);
    const e2 = encryptToken(token);
    expect(e1).not.toBe(e2);
    expect(decryptToken(e1)).toBe(token);
    expect(decryptToken(e2)).toBe(token);
  });

  it('should fail gracefully with corrupted data', () => {
    const corrupted = 'invalid:data:format';
    expect(() => decryptToken(corrupted)).toThrow();
  });
});
```

### Integration Tests
- Test token storage/retrieval through API endpoints
- Verify encrypted data in database file
- Test that unencrypted tokens never appear in logs

---

## Security Best Practices Applied

✅ **OWASP Cryptographic Storage Cheat Sheet:**
- Use AES-256 (128+ bits minimum)
- Use authenticated encryption mode (GCM)
- Random IV for each encryption
- Separate key from data

✅ **OWASP OAuth2 Cheat Sheet:**
- Restrict tokens to minimum required scope
- Use refresh token rotation
- Implement token expiration
- Separate access and refresh token storage

✅ **OWASP Top 10 Coverage:**
- A02:2021 – Cryptographic Failures: Token encryption
- A01:2021 – Broken Access Control: Scope management, authorization validation
- A07:2021 – Identification and Authentication Failures: Session security

✅ **Strava Developer Recommendations:**
- Never share tokens publicly
- Store in secure location (encrypted database)
- Implement token refresh
- Track scopes per user

---

## Before Going to Production

**MUST COMPLETE:**
1. ✅ Verify no credentials in git (COMPLETED - verified today)
2. ✅ Review OAuth scope usage (COMPLETED - minimal scope confirmed)
3. ⚠️ **Implement token encryption** (CRITICAL - needs implementation)
4. ⚠️ **Configure production CORS** (update for your domain)
5. ⚠️ **Enable HTTPS** (Railway does this automatically)
6. ⚠️ **Set production SESSION_SECRET** (unique, strong value)
7. ⚠️ **Generate TOKEN_ENCRYPTION_KEY** (`openssl rand -hex 32`)
8. ⚠️ **Test encrypt/decrypt with real data** (write integration tests)

**SHOULD COMPLETE:**
- Add security headers (Helmet)
- Implement rate limiting
- Add audit logging
- Implement token revocation endpoint
- Switch to persistent session storage

**NICE TO HAVE:**
- Intrusion detection
- Token usage analytics
- Automated security scanning in CI/CD
- Penetration testing

---

## Files Affected

- `server/src/encryption.js` - NEW (encryption utilities)
- `server/src/index.js` - MODIFY (encrypt/decrypt at DB boundary)
- `server/.env` - MODIFY (add TOKEN_ENCRYPTION_KEY)
- `server/.env.example` - MODIFY (add TOKEN_ENCRYPTION_KEY template)
- `server/src/__tests__/encryption.test.js` - NEW (encryption tests)
- `docs/DEPLOYMENT.md` - UPDATE (add encryption key setup)
- `docs/SECURITY_AUDIT.md` - THIS FILE

---

## Questions Addressed

**Q: Do we need encrypted SQLite (SQLCipher)?**
A: Not necessarily. Application-level encryption (AES-256-GCM) is simpler, equally secure, and doesn't require native modules. SQLCipher adds complexity without proportional benefit for your use case.

**Q: What if the encryption key is compromised?**
A: Rotate it immediately. All tokens would need to be re-encrypted with new key. This is why the key is stored separately in `.env`.

**Q: Should we encrypt the entire database?**
A: For this application, no. Only tokens need encryption. Participant data and activities can remain plaintext. Whole-database encryption (SQLCipher) is overkill.

**Q: Does Strava provide any guidance?**
A: Strava documentation emphasizes never sharing tokens and storing them securely. They recommend the same encryption practices outlined here.

**Q: Can we use TLS and call it secure enough?**
A: No. TLS protects data in transit. Encrypted database protects data at rest. Both are needed.

---

## References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP OAuth 2.0 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Strava API Authentication](https://developers.strava.com/docs/authentication/)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

## Sign-Off

This audit identifies one critical security issue that must be addressed before production deployment. The recommended AES-256-GCM encryption approach is straightforward to implement and follows industry best practices. Once implemented and tested, the application will meet OWASP and Strava security standards for OAuth token handling.

**Estimated implementation time:** 2-3 hours including tests
**Risk if not implemented:** HIGH - token compromise exposes user data
**Risk if implemented:** NONE - improves security without breaking changes

---

**Audit completed:** November 2025  
**Next review:** After token encryption implementation
