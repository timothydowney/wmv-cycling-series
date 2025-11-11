# Privacy Policy

**Western Mass Velo Cycling Series**  
Effective Date: November 11, 2025  
Last Updated: November 11, 2025

---

## Overview

This Privacy Policy explains how the Western Mass Velo Cycling Series application ("WMV App," "we," "us," "our") collects, uses, stores, and protects your personal data. WMV is a community tool designed to help our cycling club members organize and track weekly segment competitions.

**This is NOT a Strava product.** WMV uses Strava's API to access your activity data with your explicit permission via OAuth 2.0 authentication.

---

## 1. What Data We Collect

### 1.1 Data You Authorize via Strava OAuth

When you click "Connect with Strava," you authorize WMV to access:

- **Athlete Profile:** Your name, profile picture, location (city, state, country), and unique Strava athlete ID
- **Activity Data:** Details about your cycling activities during club events, including:
  - Activity date, time, and duration
  - Segment efforts (your performance on specific road segments)
  - Total distance and elevation
  - Activity visibility settings (public/private/followers-only)
- **Segment Data:** Information about the specific segments we track for club competitions

**We request only the minimum necessary scopes:**
- `activity:read` - Read your public and follower-visible activities
- `profile:read_all` - Read your full athlete profile

We do NOT request write access, athlete relationships, or private activity data.

### 1.2 Data We Don't Access

- ❌ Password or login credentials
- ❌ Private activities (unless you've shared them with your followers and we're authorized)
- ❌ Messages, social connections, or relationships
- ❌ Payment or billing information
- ❌ Personal training data (FTP, max heart rate, etc.)

### 1.3 Data We Generate

- **Session Data:** Your login session ID to keep you authenticated
- **Leaderboard Results:** Calculated rankings, points, and times for club competitions
- **Deletion Requests:** Records of data deletion requests and when they were processed

---

## 2. How We Use Your Data

### 2.1 Primary Purpose: Community Organization

We use your data **exclusively** to:
- Display weekly leaderboards showing club member results
- Track your performance on segment competitions
- Award club points for weekly participation
- Organize group activities and coordination

### 2.2 What We DON'T Use Your Data For

- ❌ Marketing, advertising, or promotional purposes
- ❌ Selling or sharing data with third parties
- ❌ Targeted advertising or user profiling
- ❌ AI/machine learning model training
- ❌ Replicating or competing with Strava's services
- ❌ Financial gain or monetization
- ❌ Sharing with sponsors, media, or external organizations without explicit consent

---

## 3. Who Can See Your Data

### 3.1 On the WMV App

- **Club Members Only:** Leaderboards and results are only visible to authenticated WMV users (other club members)
- **Your Data Only:** You can see all of your own performance data, including activities and segment efforts
- **Aggregated Results:** Other club members can see you on leaderboards (your name, time, rank, points) but cannot see details of your individual activities

### 3.2 Strava Integration

Your activity data remains:
- **Public on Strava:** Your activities stay public or private according to your Strava account settings
- **Unchanged:** We display data from Strava as-is; we don't modify, hide, or misrepresent your times
- **Governed by Strava:** Strava's privacy policy controls how they handle your data

---

## 4. Data Retention & Caching

### 4.1 How Long We Keep Your Data

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Athlete Profile (name, ID) | Duration of participation | Deleted when you disconnect or request deletion |
| OAuth Tokens | Until disconnected/expired | Automatically refreshed every 6 hours |
| Activity Data | Duration of competition | Deleted when you request deletion (max 48 hours) |
| Leaderboard Results | As long as competition exists | Deleted if competition is removed |
| Segment Efforts | As long as competition exists | Part of activity data deletion |
| Cache Data | Maximum 7 days | Per Strava API Agreement |
| Session Data | Until logout or expiration | Automatic expiration after 30 days |

### 4.2 Cache Limits

Per the Strava API Agreement, we cache your data for a maximum of 7 days. After 7 days:
- Cached data is refreshed from Strava
- Stale or deleted activities are removed
- Segment data is re-validated

---

## 5. Your Rights & Choices

### 5.1 Disconnect Strava (Anytime)

You can disconnect your Strava account from WMV at any time:
1. Log into WMV
2. Click "Disconnect" button
3. Confirm disconnection

**What happens when you disconnect:**
- Your OAuth token is deleted
- Your session is terminated
- You cannot access the app (but can reconnect anytime)
- Historical leaderboard data may remain (for competition integrity)

### 5.2 Request Data Deletion

You can request deletion of all your personal data:
1. Log into WMV
2. Go to Settings → "Request Data Deletion"
3. Submit deletion request
4. We will delete all data within 48 hours
5. Receive confirmation email

**What gets deleted:**
- ✅ Your athlete profile
- ✅ All OAuth tokens
- ✅ All activities and segment efforts associated with you
- ✅ All leaderboard results for your activities
- ✅ Session data
- ✅ Any deletion requests or support tickets

**What may remain (for competition integrity):**
- Final leaderboard rankings (without identifying you by name)
- Anonymized historical results

### 5.3 Access Your Data

You can request a copy of all personal data we hold:
1. Email us at [support email]
2. Include "GDPR Data Access Request" in subject
3. We will provide a JSON export within 7 days

### 5.4 Privacy Choices

- **Email Notifications:** You can opt-out of leaderboard notifications (coming soon)
- **Data Sharing:** You cannot opt-out of leaderboard display to other club members (but you can disconnect entirely)
- **Cookies:** We use essential session cookies only (no tracking/analytics cookies)

---

## 6. Data Security

### 6.1 How We Protect Your Data

- **Encryption in Transit:** All communication with Strava and between your browser and our servers uses HTTPS
- **Encryption at Rest:** OAuth tokens are encrypted using AES-256-GCM before storage in the database
- **Secure Storage:** Tokens are stored in a SQLite database with restricted access
- **No Logging:** We never log tokens, passwords, or other sensitive credentials
- **Session Security:** Session cookies are marked `Secure` and `HttpOnly` to prevent JavaScript access

### 6.2 Security Measures We Take

- HTTPS on all endpoints (enforced in production)
- Regular security audits of code and infrastructure
- Monitoring for suspicious API activity
- 24-hour security breach notification to Strava (per API Agreement)
- No third-party integrations that access Strava data

### 6.3 What We Cannot Guarantee

While we use industry-standard security practices, **no system is 100% secure.** We cannot guarantee:
- Absolute prevention of unauthorized access
- Protection against sophisticated cyber attacks
- Security of data after it leaves our system

If you're concerned about security, you can disconnect from WMV at any time.

---

## 7. Third-Party Sharing

### 7.1 Who We Share Data With

**We do NOT share your Strava data with:**
- ❌ Sponsors or media outlets
- ❌ Marketing or analytics services
- ❌ Data brokers or aggregators
- ❌ Other businesses or advertisers
- ❌ Government agencies (except legally required)
- ❌ ANY third party without explicit consent

### 7.2 Exceptions (Legal Requirements)

We may disclose your data if required by law:
- Court orders or subpoenas
- Government investigations
- Protection of safety/rights (fraud, abuse, etc.)
- Compliance with legal obligations

We will notify you of such requests when legally permitted to do so.

---

## 8. GDPR & International Privacy Laws

### 8.1 GDPR Compliance (EU/UK Users)

If you're located in the European Economic Area (EEA) or UK:

- **Legal Basis:** We process your data based on your explicit consent (via OAuth authorization)
- **Data Controller:** Western Mass Velo (cycling club)
- **Your Rights:**
  - Right to access your data
  - Right to correct inaccurate data
  - Right to delete ("right to be forgotten")
  - Right to restrict processing
  - Right to data portability
  - Right to object to processing
- **Data Protection Officer:** [Contact: admins@westmassvel.org]
- **Breach Notification:** We will notify affected individuals within 72 hours of discovering a data breach

### 8.2 California Privacy Rights (CCPA)

If you're a California resident, you have the right to:
- Know what personal data is collected
- Know whether personal data is sold or disclosed
- Delete personal information
- Opt-out of the sale of personal information

We do not sell your information, but you can exercise these rights by submitting a deletion request.

---

## 9. Children's Privacy

The WMV App is not intended for users under 18. We do not knowingly collect data from children. If we become aware that a child has provided personal information, we will delete it immediately.

If you're a parent/guardian concerned about your child's data, contact us immediately.

---

## 10. Policy Changes

### 10.1 Updates to This Policy

We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will:
- Post updates on this page with a new "Last Updated" date
- Request your re-authorization if changes significantly expand data collection or usage
- Notify club members of material changes via email

**Your continued use of WMV after updates constitutes acceptance of the revised policy.**

---

## 11. Contact & Support

### 11.1 Questions About Privacy

If you have questions or concerns about this Privacy Policy:

**Email:** admins@westmassvel.org  
**Subject:** Privacy Policy Question

**Mailing Address:**  
Western Mass Velo Cycling Club  
[Club Address]  
[City, State ZIP]

### 11.2 Data Deletion Requests

To request deletion of your data:

1. **In-App:** Settings → "Request Data Deletion" (preferred)
2. **Email:** admins@westmassvel.org with subject "Data Deletion Request"

**Response Time:** Within 48 hours (per Strava API Agreement)

### 11.3 GDPR Data Access Requests (EU/UK Users)

To request a copy of your data:

**Email:** admins@westmassvel.org  
**Subject:** "GDPR Data Access Request"

**Response Time:** Within 7 days

### 11.4 Report a Security Issue

If you discover a security vulnerability:

**Email:** admins@westmassvel.org  
**Subject:** "Security Issue Report"

Please do NOT share exploit details publicly. We will investigate and patch promptly.

---

## 12. Related Policies & Agreements

Your use of WMV also subject to:

- **[Strava API Agreement](https://www.strava.com/legal/api)** - Governs our use of Strava data
- **[Strava Privacy Policy](https://www.strava.com/legal/privacy)** - Governs how Strava handles your data
- **[WMV Terms of Service](./TERMS_OF_SERVICE.md)** - Rules for using the app (coming soon)

In the event of a conflict between policies, the Strava API Agreement and Strava's Privacy Policy take precedence for Strava data.

---

## 13. Strava Data Monitoring

Per the Strava API Agreement, Strava collects usage data about how we use their API, including:
- Number of API requests per day
- Data endpoints accessed
- Error rates and failures
- General usage patterns (not personal data)

Strava uses this data to:
- Improve their platform
- Enforce API Agreement compliance
- Prevent abuse and fraud

This is standard practice and does not impact your privacy.

---

## 14. Definitions

- **"We," "Us," "Our"**: Western Mass Velo and all administrators
- **"You," "Your"**: An individual using the WMV App
- **"Personal Data"**: Any information that identifies you or can be linked to you
- **"Strava Data"**: Activity, athlete, and segment data accessed via Strava API
- **"Segment Efforts"**: Your recorded performance on a specific road segment
- **"OAuth Token"**: Security credential allowing secure access to your Strava data
- **"Leaderboard"**: Ranked list of club members by weekly segment performance

---

## Acknowledgment

By using the Western Mass Velo Cycling Series app, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.

**Last Updated:** November 11, 2025  
**Version:** 1.0

---

## Appendix: Frequently Asked Questions

### Can you see my private activities?

No. We can only access activities according to your Strava privacy settings. If an activity is private, we cannot see it (unless you explicitly share with followers and authorize us).

### Do you sell my data?

Absolutely not. We never sell, trade, or monetize your data in any way. It's strictly for club competition tracking.

### Can I use the app anonymously?

No. We need to connect to your Strava account to identify you and track your performance. But you can disconnect anytime.

### How long do you keep my data?

Activity data is kept as long as you're participating in competitions. You can request deletion anytime, and we'll remove everything within 48 hours (except anonymized historical records).

### What if there's a data breach?

We will notify you and Strava within 24 hours of discovering any security breach. We recommend changing your Strava password as a precaution.

### Can I download my data?

Yes. Submit a "GDPR Data Access Request" (even if you're not in the EU) and we'll provide a JSON export of all your personal data within 7 days.

### Can I export my leaderboard history?

Yes, but that feature is coming soon. For now, you can screenshot leaderboards or contact admins for a historical export.

### Who owns my data?

**You do.** You own your Strava data, and we're simply providing a tool to organize club competitions. You can delete it anytime, and Strava always owns the master copy.

---

**Questions? Contact us at admins@westmassvel.org**
