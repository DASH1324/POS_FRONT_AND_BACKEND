import React, { useState } from "react";
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './navbar.css';
import logo from '../assets/logo.png';
import { FaUtensils, FaReceipt, FaChartBar, FaBell, FaChevronDown } from 'react-icons/fa';

// CHANGE #1: Accept the 'username' prop instead of 'user'
const Navbar = ({ username }) => { 
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
    localStorage.removeItem('authToken'); 
    localStorage.removeItem('username');
    navigate('/');
  };

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
          <Link to="/cashier/orders" className={`nav-item ${location.pathname === '/cashier/orders' ? 'active' : ''}`}>
            <FaReceipt className="icon" /> Orders
          </Link>
          <Link to="/admin/salesMon" className={`nav-item ${location.pathname === '/admin/salesMon' ? 'active' : ''}`}>
            <FaChartBar className="icon" /> Sales
          </Link>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-date">{currentDate}</div>
        <div className="navbar-profile">
          <div className="nav-profile-left">
            <div className="nav-profile-pic"></div>
            {/* CHANGE #2: Check for 'username' instead of 'user' */}
            {username ? (
              <div className="nav-profile-info">
                <div className="nav-profile-role">Cashier</div>
                {/* CHANGE #3: Display the 'username' variable */}
                <div className="nav-profile-name">{username}</div>
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