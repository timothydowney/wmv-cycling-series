import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WMV Cycling Series',
  description: 'Weekly segment-based cycling competitions powered by Strava',
  lang: 'en-US',
  
  // GitHub Pages configuration
  base: '/wmv-cycling-series/',
  
  head: [
    ['meta', { name: 'theme-color', content: '#FF6B35' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }],
    ['link', { rel: 'icon', href: '/wmv-cycling-series/favicon.svg', type: 'image/svg+xml' }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', width: 24, height: 24 },
    siteTitle: 'WMV Cycling',
    
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'For Athletes',
        items: [
          { text: 'Getting Started', link: '/athlete/getting-started' },
          { text: 'Connect to Strava', link: '/athlete/connect-strava' },
          { text: 'View Leaderboards', link: '/athlete/leaderboards' },
          { text: 'Understand PR Bonuses', link: '/athlete/pr-bonuses' },
          { text: 'FAQ', link: '/athlete/faq' },
        ]
      },
      {
        text: 'For Admins',
        items: [
          { text: 'Setup Guide', link: '/admin/setup' },
          { text: 'Create a Week', link: '/admin/create-week' },
          { text: 'Fetch Results', link: '/admin/fetch-results' },
          { text: 'Manage Segments', link: '/admin/manage-segments' },
          { text: 'Troubleshooting', link: '/admin/troubleshooting' },
        ]
      },
      {
        text: 'Learn',
        items: [
          { text: 'How Scoring Works', link: '/learn/scoring' },
          { text: 'About the Project', link: '/learn/about' },
        ]
      },
    ],

    sidebar: {
      '/athlete/': [
        {
          text: 'Athlete Guide',
          items: [
            { text: 'Getting Started', link: '/athlete/getting-started' },
            { text: 'Connect to Strava', link: '/athlete/connect-strava' },
            { text: 'View Leaderboards', link: '/athlete/leaderboards' },
            { text: 'Understand PR Bonuses', link: '/athlete/pr-bonuses' },
            { text: 'FAQ', link: '/athlete/faq' },
          ]
        }
      ],
      '/admin/': [
        {
          text: 'Admin Guide',
          items: [
            { text: 'Setup Guide', link: '/admin/setup' },
            { text: 'Create a Week', link: '/admin/create-week' },
            { text: 'Fetch Results', link: '/admin/fetch-results' },
            { text: 'Manage Segments', link: '/admin/manage-segments' },
            { text: 'Troubleshooting', link: '/admin/troubleshooting' },
          ]
        }
      ],
      '/learn/': [
        {
          text: 'Learning',
          items: [
            { text: 'How Scoring Works', link: '/learn/scoring' },
            { text: 'About the Project', link: '/learn/about' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/timothydowney/wmv-cycling-series' }
    ],

    footer: {
      message: 'Community-driven cycling competition tracker',
      copyright: 'Copyright © 2025 Western Mass Velo'
    },

    search: {
      provider: 'local'
    }
  },

  markdown: {
    image: {
      lazyLoading: true
    }
  }
})
