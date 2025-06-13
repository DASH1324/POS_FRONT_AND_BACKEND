import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import homeImage from "../assets/coffee.jpg";  // reuse same background image as LoginPage
import "./onboarding.css";

const Onboarding = () => {
  const navigate = useNavigate();

  const handleLogin = (role) => {
    console.log(`Logging in as ${role}`);
    if (role === "Cashier") {
      navigate("/CashierLogin");
    } else if (role === "Admin/Manager") {
      navigate("/login");
    }
  };

  return (
    <div className="onboarding-login-container">
      <div className="onboarding-login-box">
        {/* Left side with image */}
        <div
          className="onboarding-login-image"
          style={{ backgroundImage: `url(${homeImage})` }}
        ></div>

        {/* Right side with onboarding content */}
        <div className="onboarding-login-form">
          <div className="onboarding-logo-wrapper">
            <img src={logo} alt="POS System Logo" className="onboarding-login-logo" />
          </div>

          <div className="onboarding-heading">Welcome! Sign in to your POS account.</div>
          <div className="onboarding-subtext">Choose your role. Log in as:</div>

          <button
            className="onboarding-login-button"
            onClick={() => handleLogin("Cashier")}
          >
            Cashier
          </button>

          <button
            className="onboarding-login-button"
            onClick={() => handleLogin("Admin/Manager")}
          >
            Admin or Manager
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;