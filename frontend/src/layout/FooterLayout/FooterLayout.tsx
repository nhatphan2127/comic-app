import styles from './FooterLayout.module.css';

export default function FooterLayout() {
  return (
    <footer className={styles['footer-container']}>
      {/* SECTION TRÊN: Grid các cột liên kết */}
      <div className={styles['footer-top']}>
        
        {/* Cột giới thiệu và Logo */}
        <div className={styles['footer-logo-col']}>
          <div className={styles['footer-logo']}>
            <div className={styles['footer-logo-x']}>
              <span>X</span>
            </div>
            <span className={styles['footer-logo-text']}>COMIX</span>
          </div>
          <p className={styles['footer-bio']}>
            Manga and webtoons made simple — clean reader, fastest updates, always current.
          </p>
        </div>

        {/* Cột DISCOVER */}
        <div className={styles['footer-col']}>
          <h4 className={styles['footer-col-title']}>Discover</h4>
          <ul className={styles['footer-links']}>
            <li><a href="#trending-webtoon" className={styles['footer-link']}>Trending Webtoon</a></li>
            <li><a href="#trending-manga" className={styles['footer-link']}>Trending Manga</a></li>
            <li><a href="#browse-all" className={styles['footer-link']}>Browse all</a></li>
          </ul>
        </div>

        {/* Cột COMMUNITY */}
        <div className={styles['footer-col']}>
          <h4 className={styles['footer-col-title']}>Community</h4>
          <ul className={styles['footer-links']}>
            <li><a href="#upload-request" className={styles['footer-link']}>Upload Request</a></li>
            <li><a href="#upload-rules" className={styles['footer-link']}>Upload Rules</a></li>
            <li><a href="#discord" className={styles['footer-link']}>Unofficial Discord</a></li>
          </ul>
        </div>

        {/* Cột COMIX */}
        <div className={styles['footer-col']}>
          <h4 className={styles['footer-col-title']}>Comix</h4>
          <ul className={styles['footer-links']}>
            <li><a href="#contact" className={styles['footer-link']}>Contact Us</a></li>
            <li><a href="#install-pwa" className={styles['footer-link']}>Install PWA</a></li>
            <li><a href="#credits" className={styles['footer-link']}>Credits</a></li>
          </ul>
        </div>

      </div>

      {/* SECTION DƯỚI: Copyright & Metadata */}
      <div className={styles['footer-bottom']}>
        <div className={styles['footer-bottom-content']}>
          <div>
            &copy; 2026 Comix
          </div>
          <div className={styles['footer-bottom-right']}>
            <span>Made with</span>
            <span className={styles['footer-heart']}>❤</span>
            <span>&amp;</span>
            {/* SVG Logo Reddit Snoo thu nhỏ giống trong ảnh thiết kế */}
            <span className={styles['footer-reddit-icon']} title="Reddit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.3-4.14c.07-.22.25-.38.48-.41l3.52-.45c.12-.02.21-.12.21-.24V1.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.75l-3.32.42c-.41.05-.75.32-.88.71L9.12 7.55C6.63 7.61 4.37 8.25 2.7 9.27 2.14 8.49 1.22 8 0 8c-1.65 0-3 1.35-3 3 0 1.13.63 2.11 1.56 2.62-.06.29-.09.59-.09.9 0 4.14 4.03 7.5 9 7.5s9-3.36 9-7.5c0-.31-.03-.61-.09-.9.93-.51 1.56-1.49 1.56-2.62zm-16.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-5.83 3.67c-.24.24-.62.24-.86 0-.66-.66-1.74-.88-2.67-.88s-2.01.22-2.67.88c-.24.24-.62.24-.86 0-.24-.24-.24-.62 0-.86.96-.96 2.39-1.22 3.53-1.22s2.57.26 3.53 1.22c.24.24.24.62 0 .86z"/>
              </svg>
            </span>
            <span>for Manga Readers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}