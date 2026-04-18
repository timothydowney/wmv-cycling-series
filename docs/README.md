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
- **[Webhooks](./WEBHOOKS.md)** - Real-time activity updates from Strava
- **[Database Design](./DATABASE_DESIGN.md)** - Schema, queries, data flow

### Features & Operations

- **[Scoring Rules](./SCORING.md)** - Scoring formula, edge cases, and architectural details
- **[Admin Guide](../ADMIN_GUIDE.md)** - Week management, batch fetch, participant operations

### Security & Deployment

- **[Security Audit](./SECURITY_AUDIT.md)** - Comprehensive security review, encryption details, compliance
- **[Deployment Guide](./DEPLOYMENT.md)** - Railway setup, backups, monitoring, SSL, environment variables

### Future Work

- **[Roadmap](./ROADMAP.md)** - Planned features: webhooks, email, season archival, mobile app, analytics
- **[PRDs](./prds/README.md)** - Product requirements and implementation planning docs for upcoming features

### Branding & Standards

- **[Strava Branding](../STRAVA_BRANDING.md)** - OAuth button guidelines and attribution
- **[Leaderboard Design System](./LEADERBOARD_DESIGN_SYSTEM.md)** - Canonical UI language for the Weekly, Season, and Schedule tabs

---

## Quick Navigation by Role

### New Developer
1. Read: [Quick Start](./QUICK_START.md)
2. Run: `npm run dev:all`
3. Explore: [Architecture Overview](./ARCHITECTURE.md)
4. Dive in: [API Reference](./API.md) + [Database Design](./DATABASE_DESIGN.md)

### Admin (Running Competitions)
- Start: [Admin Guide](../ADMIN_GUIDE.md)
- Reference: [Strava Integration](./STRAVA_INTEGRATION.md) for participant setup

### DevOps / Deployer
- Start: [Deployment Guide](./DEPLOYMENT.md)
- Reference: [Security Audit](./SECURITY_AUDIT.md) for production checklist

### Backend Developer
- Reference: [API Reference](./API.md)
- Deep dive: [Database Design](./DATABASE_DESIGN.md)
- Scoring logic: [Scoring Rules](./SCORING.md)
- Webhooks: [Webhooks Implementation](./WEBHOOKS.md)

### Frontend Developer
- Reference: [Architecture Overview](./ARCHITECTURE.md)
- UI source of truth: [Leaderboard Design System](./LEADERBOARD_DESIGN_SYSTEM.md)
- API calls: [API Reference](./API.md)
- Auth flow: [Strava Integration](./STRAVA_INTEGRATION.md)

---

## File Organization

```
/docs/
├── README.md                   # This file - your entry point
├── prds/                       # Product and implementation planning docs
├── QUICK_START.md              # Get running in 5 minutes
├── ARCHITECTURE.md             # System design overview
├── API.md                      # Endpoint reference
├── LEADERBOARD_DESIGN_SYSTEM.md # Weekly/Season/Schedule UI source of truth
├── DATABASE_DESIGN.md          # Schema and queries
├── STRAVA_INTEGRATION.md       # OAuth and activity flow
├── WEBHOOKS.md                 # Real-time webhook processing
├── SCORING.md                  # Scoring formula and architecture
├── SECURITY_AUDIT.md           # Security review & compliance
├── DEPLOYMENT.md               # Production deployment
└── ROADMAP.md                  # Future features & enhancements

/
├── README.md                   # Project overview
├── ADMIN_GUIDE.md              # Admin operations
└── STRAVA_BRANDING.md          # Button guidelines
```

---

## Documentation at a Glance

| Document | Purpose | Read if... |
|----------|---------|-----------|
| **QUICK_START.md** | Get running immediately | You want to run the app NOW |
| **ARCHITECTURE.md** | Understand the system | You want to understand how it works |
| **API.md** | Reference all endpoints | You're building features |
| **LEADERBOARD_DESIGN_SYSTEM.md** | Public leaderboard UI rules | You're building or reviewing leaderboard-style UI |
| **DATABASE_DESIGN.md** | Understand the schema | You're working with data |
| **STRAVA_INTEGRATION.md** | Learn OAuth + activity flow | You're integrating Strava or debugging auth |
| **WEBHOOKS.md** | Real-time webhook processing | You're implementing/understanding webhooks |
| **SCORING.md** | Scoring formula and how it works | You want to understand scoring and deletion safety |
| **SECURITY_AUDIT.md** | Security review & compliance | You're auditing the codebase or deploying |
| **DEPLOYMENT.md** | Deploy to production | You're going live |
| **ROADMAP.md** | Future features & roadmap | You want to know what's planned |
| **prds/** | Product and implementation planning docs | You're preparing multi-phase feature work |
| **ADMIN_GUIDE.md** | Manage competitions | You're running events |
| **STRAVA_BRANDING.md** | Follow brand guidelines | You're adding Strava UI elements |

---

## Common Questions

**Q: How do I get started?**  
A: Read [Quick Start](./QUICK_START.md), run `npm run dev:all`, and open http://localhost:5173

**Q: How does the OAuth flow work?**  
A: See [Strava Integration](./STRAVA_INTEGRATION.md) - comprehensive guide with code examples

**Q: What's the database schema?**  
A: See [Database Design](./DATABASE_DESIGN.md) - complete schema with examples

**Q: How do I deploy to production?**  
A: See [Deployment Guide](./DEPLOYMENT.md) - Railway setup with all environment variables

**Q: How are points calculated?**  
A: See [Scoring Rules](./SCORING.md) - includes formula and deletion-safe architecture

**Q: What happens when users delete their data?**  
A: Scores automatically recalculate for remaining participants (computed on-read). See [Scoring Rules](./SCORING.md)

**Q: How do I create a week and fetch results?**  
A: See [Admin Guide](../ADMIN_GUIDE.md) - step-by-step workflow

**Q: What's the API reference?**  
A: See [API Reference](./API.md) - all endpoints with examples

**Q: Is the app secure?**  
A: See [Security Audit](./SECURITY_AUDIT.md) - comprehensive security review

**Q: What's planned for the future?**  
A: See [Roadmap](./ROADMAP.md) - webhooks, email, season archival, and more

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
- **Architecture:** Scores computed on-read from activities table (not cached), ensures deletion safety

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

---

## Still Have Questions?

- **Can't find something?** Check [Architecture Overview](./ARCHITECTURE.md) for system overview
- **Need quick reference?** Try [Quick Start](./QUICK_START.md) or [API Reference](./API.md)
- **Debugging an issue?** See troubleshooting in [Deployment Guide](./DEPLOYMENT.md)
- **Code examples?** See [Strava Integration](./STRAVA_INTEGRATION.md) and [Database Design](./DATABASE_DESIGN.md)

Happy coding! 🚴
