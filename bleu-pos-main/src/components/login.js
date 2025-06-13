import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import homeImage from "../assets/coffee.jpg";
import { Eye, EyeOff } from "lucide-react";
import "./login.css";

function Login() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const formData = new URLSearchParams();
      formData.append("username", credentials.username);
      formData.append("password", credentials.password);

      const response = await fetch("http://localhost:9000/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Login successful!");

        console.log("Access token received:", data.access_token);
        console.log("Username:", credentials.username); 

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("username", credentials.username);

        // decode token and get role
        const decodedToken = JSON.parse(atob(data.access_token.split(".")[1]));
        const userRole = decodedToken.role;

        if (userRole === "admin") {
          navigate("/admin/dashboard");
        } else if (userRole === "manager") {
          navigate("/manager-home");
        } else {
          alert("Role not recognized.");
          //clearing localStorage here if role is not recognized
          localStorage.removeItem("access_token");
          localStorage.removeItem("username");
        }
      } else {
        alert(data.message || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-form">
          <div className="logo-wrapper">
            <img src={logo} alt="Logo" className="login-logo" />
          </div>
          <p>Enter your credentials to continue.</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group password-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  required
                  autoComplete="current-password"
                />
                <span
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ cursor: "pointer" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </span>
              </div>
            </div>

            <button type="submit" className="login-button">
              Log In
            </button>
          </form>
        </div>

        <div
          className="login-image"
          style={{ backgroundImage: `url(${homeImage})` }}
        ></div>
      </div>
    </div>
  );
}

export default Login;