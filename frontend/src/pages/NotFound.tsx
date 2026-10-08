import { Link } from 'react-router-dom';
import { Home, LayoutGrid } from 'lucide-react';
import HeaderLayout from '../layout/HeaderLayout/HeaderLayout';
import cx from '../helpers/cx';
import page from './StandalonePage.module.css';

export default function NotFound() {
  return (
    <>
      <HeaderLayout />
      <main className={page.wrap}>
        <section className={cx(page.card, page.center)}>
          <p className={page.code}>404</p>
          <h1 className={page.title}>Page not found</h1>
          <p className={page.text}>The link may be broken, or the page was moved or removed.</p>
          <div className={page.actions}>
            <Link to="/" className="btn btn--primary">
              <Home size={15} />
              Home
            </Link>
            <Link to="/browse" className="btn btn--ghost">
              <LayoutGrid size={15} />
              Browse titles
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
