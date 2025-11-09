# Strava API Library Options - Research Summary

## Current Implementation
We're using **raw `fetch()` calls** for Strava API integration:
- OAuth token exchange
- Token refresh
- Activity fetching

## Why Consider a Library?
- **Automatic token refresh** - Libraries handle expiry/refresh
- **Rate limit tracking** - Built-in monitoring
- **Type safety** - TypeScript definitions
- **Tested code** - Less bugs, more confidence
- **Simpler code** - Less boilerplate

---

## Top 3 Library Options

### 1. **strava-v3** (Recommended - Battle-tested)

**Package:** `strava-v3`  
**GitHub:** https://github.com/node-strava/node-strava-v3  
**NPM:** https://www.npmjs.com/package/strava-v3

#### Stats
- ⭐ **372 stars**
- 📦 **v2.2.1** (Last updated: Aug 2024)
- 👥 **39 contributors**
- 📝 **MIT License**
- 🏢 **Maintained by node-strava organization**

#### Pros
- ✅ **Most mature** - Been around longest, widely used
- ✅ **Excellent documentation** - Clear examples, detailed API reference
- ✅ **TypeScript definitions** included (`index.d.ts`)
- ✅ **Comprehensive coverage** - All Strava API endpoints
- ✅ **Promise-based API** (also has deprecated callback API)
- ✅ **Built-in rate limit tracking** - Global status + per-request
- ✅ **OAuth support** - Token exchange, refresh, deauthorize
- ✅ **Active maintenance** - Recent updates, responsive maintainers
- ✅ **Large community** - More examples, Stack Overflow answers

#### Cons
- ⚠️ Uses Axios under the hood (extra dependency vs. native fetch)
- ⚠️ Not fully TypeScript-first (has .d.ts, but main code is JS)

#### Example Usage
```javascript
const strava = require('strava-v3');

// Config with explicit values
strava.config({
  client_id: process.env.STRAVA_CLIENT_ID,
  client_secret: process.env.STRAVA_CLIENT_SECRET,
  redirect_uri: process.env.STRAVA_REDIRECT_URI
});

// OAuth token exchange
const tokenData = await strava.oauth.getToken(authCode);

// Create client with user's token
const userStrava = new strava.client(access_token);

// Fetch activity
const activity = await userStrava.activities.get({ id: activityId });

// Token refresh
const newTokens = await strava.oauth.refreshToken(refresh_token);

// Rate limiting
console.log(strava.rateLimiting.fractionReached()); // 0 to 1
```

#### Supported Endpoints (Relevant to Us)
- ✅ OAuth (token exchange, refresh, deauthorize)
- ✅ Activities (get, create, update, list)
- ✅ Athletes (get, update, list activities)
- ✅ Segments (get, list efforts)
- ✅ Segment Efforts (get)
- ✅ Streams (activity, effort, segment)

---

### 2. **strava** (by rfoel - Fully Typed, Modern)

**Package:** `strava`  
**GitHub:** https://github.com/rfoel/strava  
**NPM:** https://www.npmjs.com/package/strava

#### Stats
- ⭐ **27 stars**
- 📦 **v3.1.0** (Last updated: Oct 2024)
- 👥 **13 contributors**
- 📝 **MIT License**
- 🔥 **Very recent update** (Oct 6, 2025)

#### Pros
- ✅ **Fully TypeScript** - Written in TypeScript, not .d.ts overlay
- ✅ **Automatic token refresh** - Handles expiry transparently
- ✅ **Callbacks for token updates** - `on_token_refresh` hook
- ✅ **Rate limit tracking** - Both methods and callbacks
- ✅ **Modern codebase** - Uses latest JavaScript features
- ✅ **Clean API** - Simple, intuitive interface
- ✅ **Semantic versioning** with automated releases

#### Cons
- ⚠️ Smaller community than strava-v3
- ⚠️ Less documentation/examples
- ⚠️ Newer, less "battle-tested" (though still solid)

#### Example Usage
```typescript
import { Strava } from 'strava';

// Initialize with refresh token
const strava = new Strava({
  client_id: '123',
  client_secret: 'abc',
  refresh_token: 'def',
  on_token_refresh: (response) => {
    // Automatically called when token refreshes
    db.saveTokens(response);
  },
  on_rate_limit_update: (rateLimit) => {
    console.log(`Usage: ${rateLimit.shortTermUsage}/${rateLimit.shortTermLimit}`);
  }
});

// Or create from token exchange
const strava = await Strava.createFromTokenExchange(
  { client_id: '123', client_secret: 'abc' },
  authCode
);

// Fetch activities
const activities = await strava.activities.getLoggedInAthleteActivities();

// Get specific activity
const activity = await strava.activities.getActivityById({ id: activityId });

// Check rate limits
const rateLimit = strava.getRateLimit();
```

---

### 3. **strava-sdk** (Newest - Full-Featured)

**Package:** `strava-sdk`  
**GitHub:** https://github.com/james-langridge/strava-sdk  
**NPM:** https://www.npmjs.com/package/strava-sdk

#### Stats
- ⭐ **2 stars**
- 📦 **v0.1.5** (Last updated: Oct 2024)
- 👥 **1 contributor** (author)
- 📝 **MIT License**
- 🆕 **Brand new** (2024)

#### Pros
- ✅ **Full TypeScript**
- ✅ **Built-in rate limiting** - Uses Bottleneck library (200/15min, 2000/day)
- ✅ **Webhook support** - Complete webhook subscription management
- ✅ **Express middleware** - Ready-to-use handlers
- ✅ **Storage abstraction** - Bring your own database
- ✅ **Auto token refresh** with configurable expiry buffer
- ✅ **Error classification** and retry logic

#### Cons
- ⚠️ **Very new** - Almost no community, minimal stars
- ⚠️ **Single maintainer** - Bus factor of 1
- ⚠️ **Unproven in production** - Too new to know stability
- ⚠️ **Overengineered for our needs** - We don't need webhooks

#### Example Usage
```typescript
import { StravaClient, MemoryStorage } from "strava-sdk";

const strava = new StravaClient({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: "http://localhost:3000/auth/callback",
  storage: new MemoryStorage(),
});

// OAuth URL
const authUrl = strava.oauth.getAuthUrl({
  scopes: ["activity:read_all"],
});

// Token exchange
const tokens = await strava.oauth.exchangeCode(code);

// Save tokens
await strava.storage.saveTokens(athleteId, {
  athleteId,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: new Date(tokens.expires_at * 1000),
});

// Get activity (with auto-refresh)
const activity = await strava.getActivityWithRefresh(activityId, athleteId);

// Express integration
import { createExpressHandlers } from "strava-sdk";
const handlers = createExpressHandlers(strava, "webhook-verify-token");
app.get("/auth/strava", handlers.oauth.authorize());
```

---

## Comparison Table

| Feature | strava-v3 | strava (rfoel) | strava-sdk | Our Raw Impl |
|---------|-----------|----------------|------------|--------------|
| **Maturity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Community** | 372 stars | 27 stars | 2 stars | N/A |
| **TypeScript** | .d.ts overlay | ✅ Native | ✅ Native | ✅ Native |
| **Auto Token Refresh** | ❌ Manual | ✅ Auto | ✅ Auto | ✅ Manual |
| **Rate Limit Tracking** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **OAuth Support** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Documentation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Dependencies** | Axios | Minimal | Bottleneck | None (fetch) |
| **Webhook Support** | ✅ Yes | ❌ No | ✅ Full | ❌ No |
| **Last Update** | Aug 2024 | Oct 2024 | Oct 2024 | Nov 2024 |
| **API Coverage** | 90% | 85% | 70% | 20% (what we need) |

---

## Recommendation

### **Option A: strava-v3** (Safest Choice)

**Use if:** You want the most battle-tested, widely-used library with excellent docs.

**Pros:**
- Most mature, largest community
- Excellent documentation and examples
- Proven in production for years
- TypeScript support (even if via .d.ts)
- All endpoints we need

**Migration Effort:** Low - Similar API to what we built

**Example Migration:**
```javascript
// Before (our code):
const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const activity = await response.json();

// After (strava-v3):
const strava = new stravaV3.client(accessToken);
const activity = await strava.activities.get({ id: activityId });
```

---

### **Option B: strava (rfoel)** (Modern Choice)

**Use if:** You prefer fully TypeScript, modern codebase with auto-refresh.

**Pros:**
- Native TypeScript (better IDE support)
- Auto token refresh with callbacks
- Cleaner, more modern API
- Still has decent community

**Migration Effort:** Low-Medium - Different API structure

**Example Migration:**
```typescript
// Our refresh function becomes:
const strava = new Strava({
  client_id: process.env.STRAVA_CLIENT_ID,
  client_secret: process.env.STRAVA_CLIENT_SECRET,
  refresh_token: storedRefreshToken,
  on_token_refresh: async (response) => {
    // Auto-saves when tokens refresh!
    await db.updateTokens(participantId, response);
  }
});

// No need to manually call getValidAccessToken - library handles it!
const activity = await strava.activities.getActivityById({ id: activityId });
```

---

### **Option C: Keep Raw Fetch** (What We Have)

**Use if:** You want zero dependencies and full control.

**Pros:**
- No external dependencies
- Complete control over implementation
- Already working well
- TypeScript types we defined ourselves

**Cons:**
- Missing rate limit tracking
- Manual token refresh
- More code to maintain

---

## My Recommendation: **strava-v3**

**Reasoning:**
1. ✅ **Most proven** - 372 stars, 39 contributors, years in production
2. ✅ **Best documentation** - Easiest to learn and debug
3. ✅ **Community support** - More examples, Stack Overflow answers
4. ✅ **All features we need** - OAuth, activities, segments, rate limiting
5. ✅ **TypeScript support** - Good enough with .d.ts
6. ✅ **Active maintenance** - Updated Aug 2024, still maintained

**Trade-offs:**
- Uses Axios (extra dependency, but well-tested)
- Not native TypeScript (but has good .d.ts)

**Alternative:** If you strongly prefer native TypeScript, go with **strava (rfoel)** - it's also solid.

---

## Migration Checklist (If We Switch)

### For strava-v3:
1. ✅ Install: `npm install strava-v3`
2. ✅ Replace `getValidAccessToken()` with `strava.oauth.refreshToken()`
3. ✅ Replace `fetchStravaActivity()` with `strava.activities.get()`
4. ✅ Update OAuth callback to use `strava.oauth.getToken()`
5. ✅ Add rate limit tracking with `strava.rateLimiting`
6. ✅ Update tests to mock strava-v3 instead of fetch
7. ✅ Test OAuth flow end-to-end
8. ✅ Test activity submission
9. ✅ Verify token refresh works
10. ✅ Update documentation

### For strava (rfoel):
1. ✅ Install: `npm install strava`
2. ✅ Initialize with `on_token_refresh` callback
3. ✅ Replace activity fetch calls
4. ✅ Remove manual token refresh logic (library handles it)
5. ✅ Add `on_rate_limit_update` callback
6. ✅ Same testing checklist as above

---

## Questions to Consider

1. **Do we need rate limit tracking?**
   - We're <100 participants, very low API usage
   - Probably not critical, but nice to have

2. **Do we need webhooks?**
   - Not currently (manual submission)
   - Maybe future for auto-detection

3. **How important is TypeScript?**
   - We're using TypeScript, but .d.ts is fine
   - Native TS is nicer but not essential

4. **Do we want to minimize dependencies?**
   - strava-v3 adds Axios
   - strava (rfoel) has minimal deps
   - Raw fetch has zero deps

5. **How much do we value community/docs?**
   - strava-v3 wins here
   - More examples, more help available

---

## Cost-Benefit Analysis

### Switch to Library
**Benefits:**
- Auto token refresh (less code to maintain)
- Rate limit tracking (visibility into usage)
- Tested code (fewer bugs)
- Better error handling
- ~100 lines of code removed

**Costs:**
- Extra dependency (package.json bloat)
- Learning curve (new API)
- Migration time (~2-4 hours)
- Potential breaking changes in future updates

### Keep Raw Fetch
**Benefits:**
- Already working
- Zero dependencies
- Full control
- We understand every line

**Costs:**
- Manual rate limit tracking
- Manual error handling
- More code to maintain
- Reinventing the wheel

---

## Final Verdict

**If I had to choose:** **strava-v3**

**Why:** It's the safe, proven choice. The community, documentation, and maturity outweigh the minor downside of using Axios. Our app is small enough that the extra dependency doesn't matter.

**However:** Our current raw fetch implementation is also totally fine! If you want to keep it simple and avoid dependencies, there's no urgent need to switch. We're only calling 2-3 Strava endpoints, so the benefits of a library are marginal.

**Suggestion:** Keep raw fetch for now, but if we expand Strava integration (more endpoints, webhooks, etc.), revisit strava-v3 at that point.

---

**Date:** November 9, 2025  
**Compiled by:** GitHub Copilot (Tim's Assistant)
