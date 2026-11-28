import React, { useState } from "react";
import { API_URL } from "../utils/helpers";

export default function AuthPage({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [authData, setAuthData] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const res = await fetch(`${API_URL}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...authData,
            username: authData.username.trim().toLowerCase(),
            email: authData.email.trim().toLowerCase(),
          }),
        });
        const data = await res.json();
        if (!res.ok) return alert(data.detail || "Signup failed");
        alert("Account created! Please log in.");
        setIsSignup(false);
      } else {
        const form = new URLSearchParams();
        form.append("username", authData.email.trim().toLowerCase());
        form.append("password", authData.password);
        const res = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) return alert(data.detail || "Login failed");
        const cleanUser = data.username.trim().toLowerCase();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", cleanUser);
        onLoginSuccess(data.access_token, cleanUser);
      }
    } catch (err) {
      alert("Server connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "20px" }}>
      <div className="ig-auth-box">
        <div className="ig-logo-text" style={{ fontSize: "38px", marginBottom: "24px", textAlign: "center" }}>
          Pixagram
        </div>
        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {isSignup && (
            <>
              <input
                className="ig-input"
                placeholder="Full Name"
                value={authData.full_name}
                onChange={(e) => setAuthData({ ...authData, full_name: e.target.value })}
                required
              />
              <input
                className="ig-input"
                placeholder="Username (lowercase, no spaces)"
                value={authData.username}
                onChange={(e) => setAuthData({ ...authData, username: e.target.value.replace(/\s+/g, "").toLowerCase() })}
                required
              />
            </>
          )}
          <input
            className="ig-input"
            type="email"
            placeholder="Email"
            value={authData.email}
            onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
            required
          />
          <input
            className="ig-input"
            type="password"
            placeholder="Password"
            value={authData.password}
            onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="ig-btn-blue"
            style={{ width: "100%", marginTop: "8px", padding: "10px" }}
          >
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>
      </div>
      <div className="ig-auth-box" style={{ padding: "18px", textAlign: "center", fontSize: "14px" }}>
        {isSignup ? "Have an account? " : "Don't have an account? "}
        <span
          style={{ color: "#0095f6", fontWeight: "600", cursor: "pointer" }}
          onClick={() => setIsSignup(!isSignup)}
        >
          {isSignup ? "Log in" : "Sign up"}
        </span>
      </div>
    </div>
  );
}