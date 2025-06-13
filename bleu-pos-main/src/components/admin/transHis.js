import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/transHis.css";
import Sidebar from "../sidebar";
import { FaChevronDown, FaBell } from "react-icons/fa";
import { DEFAULT_PROFILE_IMAGE } from "./employeeRecords";

const currentDate = new Date().toLocaleString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function TransactionHistory() {
  const [loggedInUserDisplay, setLoggedInUserDisplay] = useState({
    role: "User",
    name: "Current User",
  });
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const getAuthToken = () => {
    return localStorage.getItem("access_token");
  };

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      try {
        const decodedToken = JSON.parse(atob(token.split(".")[1]));
        setLoggedInUserDisplay({
          name: decodedToken.sub || "Current User",
          role: decodedToken.role || "User",
        });
      } catch (error) {
        console.error("Error decoding token for display:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/");
  };
  
  return (
    <div className='transaction-history'>
        <Sidebar />
        <div className='transHis'>
        <header className="header">
          <div className="header-left">
            <h2 className="page-title">Transaction History</h2>
          </div>
          <div className="header-right">
            <div className="header-date">{currentDate}</div>
            <div className="header-profile">
              <div className="profile-left">
                <div
                  className="profile-pic"
                  style={{ backgroundImage: `url(${DEFAULT_PROFILE_IMAGE})` }}
                >
                </div>
                <div className="profile-info">
                  <div className="profile-role">
                    Hi! I'm {loggedInUserDisplay.role}
                  </div>
                  <div className="profile-name">{loggedInUserDisplay.name}</div>
                </div>
              </div>

              <div className="profile-right">
                <div className="dropdown-icon" onClick={toggleDropdown}>
                  <FaChevronDown />
                </div>
                <div className="bell-icon">
                  <FaBell className="bell-outline" />
                </div>
              </div>

              {isDropdownOpen && (
                <div className="profile-dropdown">
                  <ul>
                    <li onClick={handleLogout}>Logout</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>
        </div>
    </div>
  )
}

export default TransactionHistory