# Strava Branding Guidelines Reference

**Source:** https://developers.strava.com/guidelines/

## Color Palette

- **Strava Orange:** `#FC5200`
- Use orange for:
  - "Connect with Strava" buttons
  - "View on Strava" links (text can be bold, underlined, or orange)
  - Strava logo and branding elements

## Button Usage

### Connect with Strava Button
- **Files:**
  - `btn_strava_connectwith_orange.svg` - Orange background (primary)
  - `btn_strava_connectwith_white.svg` - White background (alternative)
- **Specs:**
  - Height: 48px (@1x), 96px (@2x)
  - Must link to: `https://www.strava.com/oauth/authorize`
- **Rules:**
  - ✅ Use official button assets
  - ✅ Maintain 48px height
  - ❌ Never modify, alter, or animate the button
  - ❌ Never use Strava logos more prominently than your app name

### Powered by Strava Logo
- **File:** `powered_by_strava.svg`
- **Use when:** Displaying Strava data or attributing Strava integration
- **Placement:** Can appear near but separate from your app logo

## Text Guidelines

### Linking to Strava Data
When linking to original Strava activities, segments, or profiles:
- **Text format:** "View on Strava"
- **Styling:** Use one of:
  - Bold weight
  - Underline
  - Strava orange color (#FC5200)

### Referencing Strava
- ✅ Acceptable: "Powered by Strava" or "Compatible with Strava"
- ❌ Never: "Official Strava app" or imply sponsorship/endorsement
- ❌ Never: Use "Strava" in your app name or make it more prominent than your app name

## Logo Rules

- ✅ Keep completely separate from your app logo
- ✅ Maintain original aspect ratios
- ❌ Never use any part of Strava logo as your app icon
- ❌ Never modify, alter, or animate Strava logos
- ❌ Never imply your app was developed or sponsored by Strava

## Implementation Checklist

### OAuth Button
- [ ] Use official button SVG from `/public/assets/strava/`
- [ ] Set height to 48px
- [ ] Link to backend route `/auth/strava` (which redirects to Strava OAuth)
- [ ] No modifications to button appearance

### Activity Links
- [ ] Text: "View on Strava"
- [ ] Color: #FC5200 (Strava orange)
- [ ] Make text bold or underlined for emphasis

### Attribution
- [ ] Display "Powered by Strava" logo on leaderboard pages
- [ ] Keep separate from Western Mass Velo branding
- [ ] Don't make more prominent than app name

## Western Mass Velo Specific Usage

Our app should:
1. Show "Connect with Strava" button for OAuth (orange version)
2. Display "Powered by Strava" on leaderboard footer
3. Use "View on Strava" links for activity URLs (orange, bold)
4. Show connection status with Strava orange color (#FC5200)
5. Keep all Strava branding separate from Western Mass Velo club logo

## Resources

- Official Guidelines: https://developers.strava.com/guidelines/
- Button Downloads: https://developers.strava.com/downloads/1.1-Connect-with-Strava-Buttons.zip
- Logo Downloads: https://developers.strava.com/downloads/1.2-Strava-API-Logos.zip
- Contact: developers@strava.com
