import React from 'react';
import './AboutPage.css';
import { JerseyIcon } from './JerseyIcon';

const AboutPage: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="about-page">
      <div className="about-header">
        <h1 className="about-title">WMV Cycling Series</h1>
        <div className="about-subtitle">Virtual Hill Climbs & Time Trials</div>
      </div>

      <div className="about-section">
        <h2>About the Series</h2>
        <p>
          This series tracks weekly hill climb and time trial efforts on Zwift. 
          Participants compete on designated segments each week, earning points based on their performance and participation.
        </p>
      </div>

      <div className="about-section">
        <h2>How Scoring Works</h2>
        
        <div className="scoring-grid">
          <div className="scoring-card">
            <h3>Weekly Scoring</h3>
            <ul className="scoring-list">
              <li><strong>Beat competitors</strong> &rarr; Points equal to riders defeated</li>
              <li><strong>Participate</strong> &rarr; +1 point for completing the event</li>
              <li><strong>Set a PR</strong> &rarr; +1 bonus point for a personal record</li>
            </ul>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
              <em>Example: Finish 3rd out of 10 with a PR<br/>
              (10-3) + 1 + 1 = <strong>9 points</strong></em>
            </p>
          </div>

          <div className="scoring-card">
            <h3>Seasonal Scoring</h3>
            <p style={{ marginBottom: '15px' }}>
              Points accumulate across all weeks in the championship season.
            </p>
            <ul className="scoring-list">
              <li>Consistency is key to winning the overall</li>
              <li>Missing a week means 0 points for that round</li>
              <li>The rider with the most total points at the end wins</li>
            </ul>
          </div>
        </div>

        <h3 style={{ marginTop: '40px', color: '#333' }}>The Jerseys</h3>
        <p style={{ fontSize: '0.95rem', color: '#666', marginBottom: '1rem' }}>
          Distinct honors for leaders on both the seasonal and weekly leaderboards.
        </p>

        <div className="jerseys-grid">
          {/* Yellow Jersey Card */}
          <div className="jersey-card">
            <div className="jersey-icon-wrapper">
              <JerseyIcon type="yellow" size={64} />
            </div>
            <h4>Yellow Jersey</h4>
            <div className="jersey-definitions">
              <div className="jersey-def">
                <span className="jersey-label label-season">Season Leaderboard</span>
                <p className="jersey-desc">Held by the rider with the most total points overall.</p>
              </div>
              <div className="jersey-def">
                <span className="jersey-label label-weekly">Weekly Leaderboard</span>
                <p className="jersey-desc">Awarded to the fastest rider on non-climb events.</p>
              </div>
            </div>
          </div>

          {/* Polka Dot Jersey Card */}
          <div className="jersey-card">
            <div className="jersey-icon-wrapper">
              <JerseyIcon type="polkadot" size={64} />
            </div>
            <h4>Polka Dot Jersey</h4>
            <div className="jersey-definitions">
              <div className="jersey-def">
                <span className="jersey-label label-season">Season Leaderboard</span>
                <p className="jersey-desc">Held by the rider with the most weekly hill climb wins.</p>
              </div>
              <div className="jersey-def">
                <span className="jersey-label label-weekly">Weekly Leaderboard</span>
                <p className="jersey-desc">Awarded to the fastest rider on hill climb events.</p>
              </div>
            </div>
          </div>

          {/* Lanterne Rouge Card */}
          <div className="jersey-card">
            <div className="jersey-icon-wrapper">
              <JerseyIcon type="lantern" size={64} />
            </div>
            <h4>Lanterne Rouge</h4>
            <div className="jersey-definitions">
              <div className="jersey-def">
                <span className="jersey-label label-season">Season Leaderboard</span>
                <p className="jersey-desc">Held by the rider with the lowest total points.</p>
              </div>
              <div className="jersey-def">
                <span className="jersey-label label-weekly">Weekly Leaderboard</span>
                <p className="jersey-desc">Given to the last place finisher who completes the event.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="about-section">
        <h2>Resources</h2>
        <div className="about-links">
          <a href="https://westernmassvelo.com/" target="_blank" rel="noopener noreferrer" className="about-link">
            <svg className="about-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Western Mass Velo Website
          </a>
          <a href="https://westernmassvelo.com/about/" target="_blank" rel="noopener noreferrer" className="about-link">
            <svg className="about-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About WMV
          </a>
          <a href="https://westernmassvelo.com/rides/" target="_blank" rel="noopener noreferrer" className="about-link">
            <svg className="about-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Club Rides
          </a>
          <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="about-link">
            <svg className="about-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Privacy Policy
          </a>
          <a href="https://github.com/timothydowney/wmv-cycling-series" target="_blank" rel="noopener noreferrer" className="about-link">
            <svg className="about-link-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            GitHub Repository
          </a>
        </div>
      </div>

      <div className="strava-attribution-section">
        <span className="powered-by-text">Powered by</span>
        <a 
          href="https://www.strava.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Learn more about Strava"
        >
          <img 
            src="/assets/strava/powered_by_strava.svg" 
            alt="Powered by Strava" 
            className="strava-logo-large"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                const text = document.createElement('span');
                text.textContent = 'Powered by Strava';
                text.style.color = '#FC5200';
                text.style.fontWeight = 'bold';
                parent.appendChild(text);
              }
            }}
          />
        </a>
      </div>

      <div className="copyright-section">
        © {currentYear} Western Mass Velo. All rights reserved.
      </div>
    </div>
  );
};

export default AboutPage;
