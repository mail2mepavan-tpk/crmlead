import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Header({ toggleMenu, menuOpen }) {
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    alert('Logout functionality - implement as needed');
    setShowProfile(false);
  };

  return (
    <header className="headerBar">
      <div className="headerContent">
        {/* Left Section */}
        <div className="headerLogo">
          <button 
            className="menuToggle"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span>☰</span>
          </button>
          <Link to="/" className="logoLink">
            <span className="logoIcon">📋</span>
            <span className="logoText">EnquiryMS</span>
          </Link>
        </div>

        {/* Center Title */}
        <h1 className="headerTitle">Enquiry Management System</h1>

        {/* Right Section - User Profile */}
        <div className="profileContainer">
          <button
            className="profileBtn"
            onClick={() => setShowProfile(!showProfile)}
            title="User Profile"
          >
            <span>👤</span>
          </button>

          {showProfile && (
            <div className="profileDropdown">
              {/* Profile Info */}
              <div className="profileInfo">
                <p className="profileName">Admin User</p>
                <p className="profileEmail">admin@example.com</p>
              </div>

              {/* Menu Items */}
              <div className="profileMenu">
                <button className="profileMenuItem">
                  <span>⚙️</span>
                  Settings
                </button>
                <button
                  className="profileMenuItem logoutItem"
                  onClick={handleLogout}
                >
                  <span>🚪</span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
