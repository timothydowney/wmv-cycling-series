import React from 'react';
import { getConnectUrl } from '../api';
import './SignedOutHomePage.css';

const SignedOutHomePage: React.FC = () => {
  const handleConnect = () => {
    window.location.href = getConnectUrl();
  };

  return (
    <section className="signed-out-home" data-testid="signed-out-home">
      <div className="leaderboard-card signed-out-home-hero">
        <div className="signed-out-home-copy">
          <span className="week-header-chip signed-out-home-chip">Members sign-in</span>
          <h2>Join Western Mass Velo with Strava</h2>
          <p className="signed-out-home-lead">
            Use Connect with Strava to sign in or reconnect your account and get back into the WMV riding app.
          </p>
          <p className="signed-out-home-note">
            Returning members may see Strava ask them to confirm access again before coming back into WMV.
          </p>
          <div className="signed-out-home-actions">
            <button
              className="signed-out-home-connect"
              onClick={handleConnect}
              data-testid="signed-out-connect-button"
            >
              <img src="/assets/strava/btn_strava_connectwith_orange.svg" alt="Connect with Strava" />
            </button>
          </div>
        </div>

        <div className="signed-out-home-branding" aria-hidden="true">
          <img src="/wmv-logo.png" alt="" className="signed-out-home-logo" />
        </div>
      </div>

      <div className="signed-out-home-grid">
        <article className="leaderboard-card signed-out-home-card">
          <h3>What you get after sign-in</h3>
          <ul>
            <li>One connected WMV app experience tied to your Strava account.</li>
            <li>Member-specific views and ride-tracking tools.</li>
            <li>Club context and links.</li>
          </ul>
        </article>

        <article className="leaderboard-card signed-out-home-card">
          <h3>Western Mass Velo</h3>
          <p>
            WMV is a Western Massachusetts cycling club with rides, events, and a shared Strava-based member experience.
          </p>
          <a
            className="signed-out-home-link"
            href="https://westernmassvelo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit the WMV website
          </a>
        </article>
      </div>
    </section>
  );
};

export default SignedOutHomePage;