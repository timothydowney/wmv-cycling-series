import './Footer.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section footer-info">
          <p className="footer-text">
            Western Mass Velo Cycling Series
          </p>
          <p className="footer-copyright">
            © {currentYear} Western Mass Velo. All rights reserved.
          </p>
        </div>

        <div className="footer-section footer-links">
          <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="footer-link">
            Privacy Policy
          </a>
          <span className="footer-separator">•</span>
          <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" className="footer-link">
            Strava
          </a>
        </div>

        <div className="footer-section footer-attribution">
          <p className="footer-text powered-by">
            Powered by
          </p>
          <a 
            href="https://www.strava.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="strava-attribution"
            title="Learn more about Strava"
          >
            <svg className="strava-logo" viewBox="0 0 24 24" fill="currentColor">
              {/* Strava logo icon - the "S" shape */}
              <path d="M15.387 17.944c-2.153-1.423-4.877-2.231-7.787-2.231-5.14 0-9.6 4.46-9.6 9.6s4.46 9.6 9.6 9.6c2.861 0 5.585-.808 7.787-2.231l-10.02-15.169h6.02v4.031zM15.387 0c-2.153 1.423-4.877 2.231-7.787 2.231-5.14 0-9.6-4.46-9.6-9.6s4.46-9.6 9.6-9.6c2.861 0 5.585.808 7.787 2.231l10.02 15.169h-6.02v-4.031z" />
            </svg>
            <span className="strava-text">Strava</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
