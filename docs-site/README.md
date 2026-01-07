# WMV Cycling Series Documentation Site

A user-friendly documentation site for the WMV Cycling Series built with **VitePress** and **GitHub Pages**.

## 🎯 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

The dev server runs at `http://localhost:5173` with the base path `/wmv-cycling-series/`.

### Capture Screenshots

```bash
# Interactive mode (shows browser window)
npm run screenshots

# Headless mode (no browser window)
npm run screenshots:headless

# Custom production URL
PRODUCTION_URL=https://my-domain.com npm run screenshots
```

Screenshots are saved to `.vitepress/public/screenshots/`.

## 📁 Directory Structure

```
docs-site/
├── .vitepress/
│   ├── config.ts              # VitePress configuration
│   ├── theme/
│   │   ├── index.ts           # Theme customization
│   │   └── custom.css         # Custom styles and branding
│   └── public/
│       └── screenshots/       # Generated documentation screenshots
├── index.md                    # Homepage
├── athlete/
│   ├── getting-started.md
│   ├── connect-strava.md
│   ├── leaderboards.md
│   ├── pr-bonuses.md
│   └── faq.md
├── admin/
│   ├── setup.md
│   ├── create-week.md
│   ├── fetch-results.md
│   ├── manage-segments.md
│   └── troubleshooting.md
├── learn/
│   ├── scoring.md
│   └── about.md
├── package.json
├── playwright.config.ts       # Playwright browser automation config
├── screenshots.spec.ts        # Screenshot capture tests
└── README.md                  # This file
```

## 🎨 Content Structure

### For Athletes (`/athlete/`)
- **Getting Started** - Overview and quick walkthrough
- **Connect Strava** - Step-by-step OAuth connection guide
- **View Leaderboards** - How to read and understand leaderboards
- **Understand PR Bonuses** - Personal record bonus system
- **FAQ** - Common questions and troubleshooting

### For Admins (`/admin/`)
- **Setup Guide** - Initial configuration and permissions
- **Create a Week** - Step-by-step week creation
- **Fetch Results** - Collecting and posting leaderboards
- **Manage Segments** - Segment validation and caching
- **Troubleshooting** - Common admin issues and fixes

### Learning (`/learn/`)
- **How Scoring Works** - Complete points system explanation
- **About the Project** - Vision, roadmap, and technology

## 🔧 Configuration

### VitePress Config (`config.ts`)

Key settings:
- **Base path:** `/wmv-cycling-series/` (GitHub Pages subpath)
- **Theme:** Default VitePress theme with custom CSS
- **Search:** Local search provider for offline functionality
- **Nav structure:** Athlete, Admin, and Learning sections

### Custom Styling (`theme/custom.css`)

- Brand colors (WMV orange: `#FF6B35`)
- Home page hero and feature grids
- Responsive card layouts
- Dark mode support
- Screenshot and callout styling

## 📸 Screenshots & Visual Documentation

### Automated Capture

The `screenshots.spec.ts` file uses Playwright to automate screenshot capture:

```typescript
npm run screenshots
```

Captures include:
- Homepage and hero section
- Weekly/Season leaderboards
- Admin panel and forms
- Participant status
- Mobile responsive views
- Navigation and footer

### Manual Usage

If you want to add custom screenshots:

1. Run the screenshot tests with `--headed` flag
2. The browser will stay open for manual navigation
3. Right-click → Save image or use Playwright snapshot features

### Adding Screenshots to Docs

1. Run screenshot capture (saves to `.vitepress/public/screenshots/`)
2. Reference in markdown: `![Alt text](/screenshots/filename.png)`
3. Include in relevant documentation page

## 🚀 Deployment

### GitHub Pages (Automated)

Every push to `main` that touches `docs-site/` automatically:

1. Installs dependencies
2. Builds with VitePress
3. Deploys to GitHub Pages (`gh-pages` branch)
4. Site is live at: `https://username.github.io/wmv-cycling-series/`

### Manual Deployment

```bash
# Build docs
npm run docs:build

# The .vitepress/dist folder is ready for deployment
```

### Environment

For custom deployments, set:
- `PRODUCTION_URL` - URL for screenshot capture
- `VITE_BASE` - Base path (default: `/wmv-cycling-series/`)

## 📝 Writing Documentation

### Markdown Features

VitePress supports enhanced Markdown:

```markdown
# Heading 1
## Heading 2

**Bold text**
*Italic text*

> Blockquote
> Multi-line

- Bullet list
  - Nested item

| Table | Column |
|-------|--------|
| Row 1 | Data   |

[Link text](./path/to/page.md)
[External link](https://example.com)

![Image alt text](/screenshots/image.png)

::: tip
Custom callout boxes for tips
:::

::: warning
Warning callouts
:::

::: danger
Danger callouts
:::
```

### Best Practices

1. **User-centric:** Write for the end user, not developers
2. **Jargon-free:** Explain technical terms in simple language
3. **Step-by-step:** Break complex tasks into numbered steps
4. **Screenshots:** Include visual references where helpful
5. **Examples:** Provide concrete examples and scenarios
6. **Links:** Cross-reference related documentation
7. **FAQ:** Answer common questions with concise answers

## 🔍 Search

Local search is enabled. Users can:
- Use Ctrl+K (or Cmd+K) to open search
- Search by title, headings, and content
- Works offline (no external dependencies)

## 🎯 Navigation Structure

```
Home (/)
├─ For Athletes (/athlete/)
│  ├─ Getting Started
│  ├─ Connect to Strava
│  ├─ View Leaderboards
│  ├─ Understand PR Bonuses
│  └─ FAQ
├─ For Admins (/admin/)
│  ├─ Setup Guide
│  ├─ Create a Week
│  ├─ Fetch Results
│  ├─ Manage Segments
│  └─ Troubleshooting
└─ Learn (/learn/)
   ├─ How Scoring Works
   └─ About the Project
```

## 🔐 GitHub Pages Setup (One-Time)

1. Go to repository **Settings** → **Pages**
2. Set **Source** to `Deploy from a branch`
3. Set **Branch** to `gh-pages` / `root`
4. Save (workflow auto-creates `gh-pages` branch)

## 📊 Site Analytics (Optional)

To add analytics, edit `.vitepress/config.ts`:

```typescript
head: [
  ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID' }],
  ['script', { 'data-goatcounter': 'https://example.goatcounter.com/count' }],
]
```

## 🆘 Troubleshooting

### Build Fails
```bash
npm install                 # Reinstall deps
npm run docs:build         # Try again
```

### Screenshots Don't Capture
```bash
# Check Playwright is installed
npx playwright install

# Run with verbose output
PWDEBUG=1 npm run screenshots
```

### Site Not Updating
- Clear GitHub Pages cache (Settings → Pages → clear)
- Wait 5-10 minutes for deployment
- Check Actions tab for build status

### Base Path Issues
- Ensure `base: '/wmv-cycling-series/'` in config.ts
- Links should be relative: `[link](./path/to/page.md)`

## 📚 Resources

- [VitePress Documentation](https://vitepress.dev/)
- [Markdown Guide](https://vitepress.dev/guide/markdown)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Playwright Documentation](https://playwright.dev/)

## 🤝 Contributing

To add or update documentation:

1. Edit markdown files in appropriate directory
2. Test locally: `npm run docs:dev`
3. Commit and push to main
4. GitHub Actions auto-deploys

For screenshots:
1. Ensure production URL is accessible
2. Run `npm run screenshots`
3. Add to `.vitepress/public/screenshots/`
4. Reference in markdown

## 📄 License

Documentation is part of the WMV Cycling Series project. See main repository for license details.

---

**Need help?** Check VitePress docs or open an issue on GitHub.
