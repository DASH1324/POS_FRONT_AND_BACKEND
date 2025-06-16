import React, { useState } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './navbar.css';
import logo from '../assets/logo.png';
import { FaUtensils, FaReceipt, FaChartBar, FaBell, FaChevronDown } from 'react-icons/fa';

// KEY CHANGE 1: The component now accepts the 'user' prop from the Menu component.
const Navbar = ({ user }) => { 
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // This logic for the date is perfectly fine.
  const currentDate = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    // It's good practice to clear all user-related data on logout.
    localStorage.removeItem('authToken'); 
    localStorage.removeItem('username');
    navigate('/');
  };

  // KEY CHANGE 2: The following state and effect are no longer needed.
  // The username is now coming from the 'user' prop, which is more reliable.
  /*
    const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({ role: "User", name: "Current User" });
    useEffect(() => {
        const token = getAuthToken();
        if (token) {
            // ... this logic is redundant
        }
    }, []);
  */

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="navbar-logo">
          <img src={logo} alt="Logo" className="logo-nav" />
        </div>
        <div className="nav-icons">
          <Link to="/cashier/menu" className={`nav-item ${location.pathname === '/cashier/menu' ? 'active' : ''}`}>
            <FaUtensils className="icon" /> Menu
          </Link>
          <Link to="/orders" className={`nav-item ${location.pathname === '/orders' ? 'active' : ''}`}>
            <FaReceipt className="icon" /> Orders
          </Link>
          <Link to="/sales" className={`nav-item ${location.pathname === '/sales' ? 'active' : ''}`}>
            <FaChartBar className="icon" /> Sales
          </Link>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-date">{currentDate}</div>
        <div className="navbar-profile">
          <div className="nav-profile-left">
            <div className="nav-profile-pic"></div>
            {/* KEY CHANGE 3: Use the 'user' prop for display */}
            {user ? (
              <div className="nav-profile-info">
                <div className="nav-profile-role">Cashier</div>
                <div className="nav-profile-name">{user}</div>
              </div>
            ) : (
              <div className="nav-profile-info">
                <div className="nav-profile-name">Loading...</div>
              </div>
            )}
          </div>
        
          <div className="nav-profile-right">
            <div className="nav-dropdown-icon" onClick={toggleDropdown}><FaChevronDown /></div>
            <div className="nav-bell-icon"><FaBell className="bell-outline" /></div>
          </div>
        
          {isDropdownOpen && (
          <div className="nav-profile-dropdown">
            <ul>
              <li onClick={handleLogout}>Logout</li>
            </ul>
          </div>
          )}

        </div>
      </div>
    </header>
  );
};

export default Navbar;