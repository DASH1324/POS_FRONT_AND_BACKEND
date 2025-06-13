import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import coffeeImage from "../assets/CaramelMachiatto.jpg";
import { Eye, EyeOff } from "lucide-react";
import "./CashierLogin.css";

const CashierLogin = () => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (password.trim() === "") {
      setError("Passcode field cannot be empty.");
      return;
    }

    try {
      const username = "cashier";

      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await fetch("http://localhost:9000/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (response.ok) {
        alert("Login successful!");
        navigate("/cashier/menu");
      } else {
        alert(data.message || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred. Please try again later.");
    }
  };

  return (
    <div className="cashierLogin-container">
      <div className="cashierLogin-box">
        <div className="cashierLogin-form">
          <div className="cashierLogin-logo-wrapper">
            <img src={logo} alt="Bleu Bean Cafe" className="cashierLogin-circle-logo" />
          </div>
          <p>Please enter your passcode to continue.</p>

          <form onSubmit={handleLogin}>
            {error && <div className="cashierLogin-error-alert">{error}</div>}

            <div className="cashierLogin-form-group cashierLogin-password-group">
              <label htmlFor="passcode">Passcode</label>
              <div className="cashierLogin-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="passcode"
                  placeholder="Enter your passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={6}
                  autoComplete="current-password"
                />
                <span
                  className="cashierLogin-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide passcode" : "Show passcode"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </span>
              </div>
            </div>

            <button type="submit" className="cashierLogin-button">
              Log In
            </button>
          </form>
        </div>

        <div
          className="cashierLogin-image"
          style={{ backgroundImage: `url(${coffeeImage})` }}
        ></div>
      </div>
    </div>
  );
};

export default CashierLogin;