import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './navbar.css';
import logo from '../assets/logo.png';
import { FaUtensils, FaReceipt, FaChartBar, FaBell, FaChevronDown } from 'react-icons/fa';

const Navbar = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
  localStorage.removeItem('access_token');
  navigate('/');
};

const getAuthToken = () => {
    return localStorage.getItem("access_token");
};

const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({ role: "User", name: "Current User" });
      useEffect(() => {
          const token = getAuthToken();
          if (token) {
              try {
                  const decodedToken = JSON.parse(atob(token.split('.')[1]));
                  setLoggedInUserDisplay({
                      name: decodedToken.sub || "Current User",
                      role: decodedToken.role || "User"
                  });
              } catch (error) {
                  console.error("Error decoding token for display:", error);
              }
          }
      }, []);

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
            <div className="nav-profile-info">
              <div className="nav-profile-role">Hi! I'm {loggedInUserDisplay.role}</div>
              <div className="nav-profile-name">{loggedInUserDisplay.name}</div>
            </div>
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