import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '.vitepress/public/screenshots');
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://wmv-cycling-series-production.up.railway.app';

/**
 * WMV Cycling Series Screenshot Capture Script
 * 
 * This script automates capturing documentation screenshots from the production URL.
 * Run with: npm run screenshots
 * 
 * Set custom URL: PRODUCTION_URL=https://your-url npm run screenshots
 */

test.describe('WMV Documentation Screenshots', () => {
  
  test('capture homepage', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    // Capture full homepage
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'homepage.png'),
      fullPage: true
    });
    
    // Capture hero section
    const heroSection = await page.locator('[class*="hero"]').first();
    if (await heroSection.isVisible()) {
      await heroSection.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'hero-section.png')
      });
    }
  });

  test('capture athlete getting started flow', async ({ page }) => {
    // Homepage with Connect button visible
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    const connectButton = await page.locator('button, a').filter({ hasText: /Connect|Login/i }).first();
    if (await connectButton.isVisible()) {
      await connectButton.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'connect-button.png')
      });
    }
  });

  test('capture weekly leaderboard', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Look for leaderboard table
    const leaderboardTable = await page.locator('table').first();
    if (await leaderboardTable.isVisible()) {
      await leaderboardTable.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'weekly-leaderboard.png')
      });
    }
  });

  test('capture season leaderboard tab', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Look for Season tab and click if exists
    const seasonTab = await page.locator('button, [role="tab"]').filter({ hasText: /Season/i }).first();
    if (await seasonTab.isVisible()) {
      await seasonTab.click();
      await page.waitForTimeout(500);
      
      const seasonTable = await page.locator('table').first();
      if (await seasonTable.isVisible()) {
        await seasonTable.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'season-leaderboard.png')
        });
      }
    }
  });

  test('capture week selector', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}`);
    await page.waitForLoadState('networkidle');
    
    // Look for week selector dropdown
    const weekSelector = await page.locator('select').first();
    if (await weekSelector.isVisible()) {
      await weekSelector.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'week-selector.png')
      });
    }
  });

  test('capture admin panel - manage competition', async ({ page, context }) => {
    /**
     * Note: This requires being logged in as an admin.
     * Set ADMIN_EMAIL and ADMIN_PASSWORD in environment variables to auto-login,
     * or manually log in when prompted.
     */
    
    await page.goto(`${PRODUCTION_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Check if redirected to login
    const isLoginPage = await page.locator('input[type="password"]').isVisible().catch(() => false);
    
    if (isLoginPage) {
      console.log('⚠️  Admin page requires login. Please log in manually in the browser window.');
      // Wait for manual login (30 seconds)
      await page.waitForTimeout(30000);
    }
    
    // Capture admin panel if visible
    const adminPanel = await page.locator('[class*="admin"], [class*="panel"]').first();
    if (await adminPanel.isVisible()) {
      await adminPanel.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'admin-panel.png')
      });
    }
  });

  test('capture admin - create week form', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Look for "Create Week" button
    const createButton = await page.locator('button, a').filter({ hasText: /Create Week|New Event/i }).first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForLoadState('networkidle');
      
      // Capture the form
      const form = await page.locator('form').first();
      if (await form.isVisible()) {
        await form.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'create-week-form.png')
        });
      }
    }
  });

  test('capture admin - participant status', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/participants`);
    await page.waitForLoadState('networkidle');
    
    // Capture participant list
    const participantList = await page.locator('table, [class*="participant"], [class*="list"]').first();
    if (await participantList.isVisible()) {
      await participantList.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'participant-status.png')
      });
    }
  });

  test('capture admin - manage segments', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/segments`);
    await page.waitForLoadState('networkidle');
    
    // Capture segment manager
    const segmentManager = await page.locator('[class*="segment"], main').first();
    if (await segmentManager.isVisible()) {
      await segmentManager.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'manage-segments.png')
      });
    }
  });

  test('capture mobile responsive - homepage', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'mobile-homepage.png'),
      fullPage: true
    });
  });

  test('capture mobile responsive - leaderboard', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    const leaderboardTable = await page.locator('table').first();
    if (await leaderboardTable.isVisible()) {
      await leaderboardTable.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'mobile-leaderboard.png')
      });
    }
  });

  test('capture footer and navigation', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Capture footer
    const footer = await page.locator('footer').first();
    if (await footer.isVisible()) {
      await footer.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'footer.png')
      });
    }
  });

  test('capture top navigation', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    
    // Capture header/nav
    const header = await page.locator('header, nav').first();
    if (await header.isVisible()) {
      await header.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'top-navigation.png')
      });
    }
  });

});

/**
 * Usage Examples:
 * 
 * 1. Capture all screenshots (requires browser interaction for admin):
 *    $ npm run screenshots
 * 
 * 2. Run headless (no browser window):
 *    $ npm run screenshots:headless
 * 
 * 3. Use custom production URL:
 *    $ PRODUCTION_URL=https://my-domain.com npm run screenshots
 * 
 * 4. Run single test:
 *    $ npx playwright test --grep "capture homepage"
 * 
 * Screenshots are saved to: docs-site/.vitepress/public/screenshots/
 * Reference in markdown: ![Alt text](/screenshots/filename.png)
 */
