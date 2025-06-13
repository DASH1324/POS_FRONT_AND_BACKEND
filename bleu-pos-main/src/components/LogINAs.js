import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate for navigation
import "./LogINAs.css"; // Ensure the CSS file is named LogINAs.css
import logo from "../assets/bleu_logo1.jpg"; // Add your coffee shop logo here

const LogINAs = () => {
  const navigate = useNavigate(); // Initialize the navigate function

  const handleLogin = (role) => {
    console.log(`Logging in as ${role}`);
    if (role === "Cashier") {
      navigate("/cashier-login"); // Navigate to CashierLogin page
    } else if (role === "Admin/Manager") {
      navigate("/login"); // Navigate to Login page for Admin/Manager
    }
  };

  return (
    <div className="button-container">
      <img src={logo} alt="Blue Coffee Shop Logo" className="logo" />
      <h2>Welcome to Bleu Bean Coffee Shop POS</h2>
      <p>Log in to manage your tasks</p>

      <button className="role-btn" onClick={() => handleLogin("Cashier")}>
        Log in as Cashier
      </button>
      <button className="role-btn" onClick={() => handleLogin("Admin/Manager")}>
        Log in as Admin/Manager
      </button>

      <div className="role-btn-text">
        <p>For cashiers, please use your passcode. Admin/Manager access requires login credentials.</p>
      </div>
    </div>
  );
};

export default LogINAs;
