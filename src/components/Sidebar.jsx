import { Link } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="sidebarOverlay"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close Button (Mobile Only) */}
        <button
          className="sidebarCloseBtn"
          onClick={onClose}
          aria-label="Close menu"
        >
          ✕
        </button>

        {/* Navigation */}
        <nav className="sidebarNav">
          <Link
            to="/"
            className="navItem"
            onClick={onClose}
          >
            <span className="navIcon">📊</span>
            <span className="navLabel">Dashboard</span>
          </Link>

          <Link
            to="/intake"
            className="navItem"
            onClick={onClose}
          >
            <span className="navIcon">📝</span>
            <span className="navLabel">New Enquiry</span>
          </Link>

          <hr className="navDivider" />

          <button className="navItem">
            <span className="navIcon">⚙️</span>
            <span className="navLabel">Settings</span>
          </button>

          <button className="navItem">
            <span className="navIcon">📚</span>
            <span className="navLabel">Help & Support</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
