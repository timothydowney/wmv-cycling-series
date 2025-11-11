# Documentation Index

Welcome to the WMV Cycling Series documentation. Start with **Getting Started**, then explore the topic you need.

## Getting Started

- **[Quick Start](./QUICK_START.md)** - Run the app in 5 minutes (start here!)
- **[Architecture Overview](./ARCHITECTURE.md)** - High-level system design
- **[Deployment Guide](./DEPLOYMENT.md)** - How to deploy to production

## Core Documentation

### API & Integration

- **[API Reference](./API.md)** - Complete endpoint reference
- **[Strava Integration](./STRAVA_INTEGRATION.md)** - OAuth flow, token management, activity collection
  - **[OAuth Session Fix](./OAUTH_SESSION_FIX.md)** - Technical details: reverse proxy & session persistence
  - **[OAuth Fix Summary](./OAUTH_FIX_SUMMARY.md)** - Analysis of the OAuth session debugging journey
- **[Database Design](./DATABASE_DESIGN.md)** - Schema, queries, data flow

### Features & Operations

- **[Architecture Overview](./ARCHITECTURE.md)** - System design, data flow, tech stack
- **[Scoring Rules](./SCORING.md)** - How points are calculated
- **[Admin Guide](../ADMIN_GUIDE.md)** - Week management, batch fetch, participant operations

### Security & Deployment

- **[Security Audit](./SECURITY_AUDIT.md)** - Comprehensive security review
- **[Token Encryption Guide](./TOKEN_ENCRYPTION_GUIDE.md)** - Token storage and encryption
- **[Deployment Guide](./DEPLOYMENT.md)** - Railway setup, backups, monitoring

### Branding & Standards

- **[Strava Branding](../STRAVA_BRANDING.md)** - OAuth button guidelines and attribution
- **[Pre-Commit Checklist](./PRE_COMMIT_CHECKLIST.md)** - Code quality standards

---

## Quick Navigation by Role

### New Developer (You)
1. Read: [Quick Start](./QUICK_START.md)
2. Run: `npm run dev:all`
3. Explore: [Architecture Overview](./ARCHITECTURE.md)
4. Dive in: [API Reference](./API.md) + [Database Design](./DATABASE_DESIGN.md)

### Admin (Running Competitions)
- Start: [Admin Guide](../ADMIN_GUIDE.md)
- Reference: [Strava Integration](./STRAVA_INTEGRATION.md) for participant setup

### DevOps / Deployer
- Start: [Deployment Guide](./DEPLOYMENT.md)
- Reference: [Strava Branding](../STRAVA_BRANDING.md) for OAuth button setup

### Backend Developer
- Reference: [API Reference](./API.md)
- Deep dive: [Database Design](./DATABASE_DESIGN.md)
- Integration: [Strava Integration](./STRAVA_INTEGRATION.md)

### Frontend Developer
- Reference: [Architecture Overview](./ARCHITECTURE.md)
- API calls: [API Reference](./API.md)
- Auth flow: [Strava Integration](./STRAVA_INTEGRATION.md)

---

## File Organization

```
/docs/
├── README.md                  # This file - your entry point
├── QUICK_START.md             # Get running in 5 minutes
├── ARCHITECTURE.md            # System design overview
├── API.md                     # Endpoint reference
├── DATABASE_DESIGN.md         # Schema and queries
├── STRAVA_INTEGRATION.md      # OAuth and activity flow
│   ├── OAUTH_SESSION_FIX.md   #   → Technical: Reverse proxy & sessions
│   └── OAUTH_FIX_SUMMARY.md   #   → Analysis: How we debugged it
├── SCORING.md                 # Points calculation
├── SECURITY_AUDIT.md          # Security review
├── TOKEN_ENCRYPTION_GUIDE.md  # Token encryption details
├── PRE_COMMIT_CHECKLIST.md    # Code standards
└── DEPLOYMENT.md              # Production deployment

/
├── README.md                  # Project overview (start here for new users)
├── ADMIN_GUIDE.md             # Admin operations (week management, batch fetch)
└── STRAVA_BRANDING.md         # Button guidelines and attribution
```

---

## Documentation at a Glance

| Document | Purpose | Read if... |
|----------|---------|-----------|
| **QUICK_START.md** | Get running immediately | You want to run the app NOW |
| **ARCHITECTURE.md** | Understand the system | You want to understand how it works |
| **API.md** | Reference all endpoints | You're building features |
| **DATABASE_DESIGN.md** | Understand the schema | You're working with data |
| **STRAVA_INTEGRATION.md** | Learn OAuth + activity flow | You're integrating Strava or debugging auth |
| **OAUTH_SESSION_FIX.md** | Technical: Reverse proxy sessions | You need reverse proxy/production details |
| **OAUTH_FIX_SUMMARY.md** | Analysis of OAuth debugging | You want to understand the fixes |
| **SCORING.md** | Understand scoring rules | You're checking point calculations |
| **SECURITY_AUDIT.md** | Security review | You're auditing the codebase |
| **TOKEN_ENCRYPTION_GUIDE.md** | Token encryption details | You're implementing encryption |
| **PRE_COMMIT_CHECKLIST.md** | Code standards | You want to maintain quality |
| **DEPLOYMENT.md** | Deploy to production | You're going live |
| **ADMIN_GUIDE.md** | Manage competitions | You're running events |
| **STRAVA_BRANDING.md** | Follow brand guidelines | You're adding Strava UI elements |

---

## Common Questions

**Q: How do I get started?**  
A: Read [Quick Start](./QUICK_START.md), run `npm run dev:all`, and open http://localhost:5173

**Q: How does the OAuth flow work?**  
A: Start with [Strava Integration](./STRAVA_INTEGRATION.md) for the comprehensive guide with code examples. If you need production/reverse proxy details, see [OAuth Session Fix](./OAUTH_SESSION_FIX.md). For background on how we debugged it, see [OAuth Fix Summary](./OAUTH_FIX_SUMMARY.md).

**Q: Why is OAuth failing in production?**  
A: Almost always a reverse proxy session issue. See [OAuth Session Fix](./OAUTH_SESSION_FIX.md) for full technical explanation and solution.

**Q: What's the database schema?**  
A: See [Database Design](./DATABASE_DESIGN.md) - complete schema with examples

**Q: How do I deploy to production?**  
A: See [Deployment Guide](./DEPLOYMENT.md) - Railway setup instructions with all environment variables

**Q: How are points calculated?**  
A: See [Scoring Rules](./SCORING.md) - complete scoring formula

**Q: How do I create a week and fetch results?**  
A: See [Admin Guide](../ADMIN_GUIDE.md) - step-by-step workflow

**Q: What's the API reference?**  
A: See [API Reference](./API.md) - all endpoints with examples

**Q: Is the app secure?**  
A: See [Security Audit](./SECURITY_AUDIT.md) - comprehensive security review

---

## Key Concepts

### Weekly Competition
1. Admin creates week (segment, date, time window)
2. Participants connect Strava (one-time OAuth)
3. Participants ride and sync to Strava
4. Admin triggers batch fetch
5. System finds best activity per participant
6. Leaderboard automatically updates with rankings and points

### Scoring
- **Base Points:** Number of participants you beat + 1 (for competing)
- **PR Bonus:** +1 if you set a personal record
- **Season Total:** Sum of all weekly points

### Authentication
- Each participant has unique Strava OAuth tokens
- Tokens auto-refresh every 6 hours
- Sessions stored in database (production) or memory (dev)

### Scale
- Designed for <100 participants
- SQLite handles thousands of activities easily
- No scaling concerns for Western Mass Velo

---

## Navigation Tips

- Use Ctrl+F (or Cmd+F) to search within any document
- Links between docs use relative paths, so they work everywhere
- Click [Documentation Index](#documentation-index) to jump back to this page
- Emoji markers:
  - 🆕 = New or recently updated
  - ⏳ = In progress
  - ✅ = Complete
  - 📋 = Planned for future

---

## Still Have Questions?

- **Can't find something?** Check ARCHITECTURE.md for system overview
- **Need quick reference?** Try QUICK_START.md or API.md
- **Debugging an issue?** See troubleshooting in QUICK_START.md or DEPLOYMENT.md
- **Code examples?** See STRAVA_INTEGRATION.md and DATABASE_DESIGN.md

Happy coding! 🚴
