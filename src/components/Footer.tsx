import './Footer.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section footer-info">
          <p className="footer-text">
            <a href="https://westernmassvelo.com/" target="_blank" rel="noopener noreferrer" className="footer-wmv-link">
              Western Mass Velo
            </a>
            {' '}Zwift Hill Climb/Time Trial Series
          </p>
          <p className="footer-copyright">
            © {currentYear} Western Mass Velo. All rights reserved.
          </p>
        </div>

        <div className="footer-section footer-links">
          <a href="https://westernmassvelo.com/about/" target="_blank" rel="noopener noreferrer" className="footer-link">
            About
          </a>
          <span className="footer-separator">•</span>
          <a href="https://westernmassvelo.com/rides/" target="_blank" rel="noopener noreferrer" className="footer-link">
            Rides
          </a>
          <span className="footer-separator">•</span>
          <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="footer-link">
            Privacy
          </a>
          <span className="footer-separator">•</span>
          <a href="https://github.com/timothydowney/wmv-cycling-series" target="_blank" rel="noopener noreferrer" className="footer-link">
            GitHub
          </a>
          <span className="footer-separator">•</span>
          <a 
            href="https://www.strava.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="strava-attribution"
            title="Learn more about Strava"
          >
            <span className="powered-by-text">Powered by</span>
            <img 
              src="/assets/strava/powered_by_strava.svg" 
              alt="Powered by Strava" 
              className="strava-logo-img"
              onError={(e) => {
                // Fallback text if SVG fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const text = document.createElement('span');
                  text.textContent = 'Powered by Strava';
                  parent.appendChild(text);
                }
              }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
