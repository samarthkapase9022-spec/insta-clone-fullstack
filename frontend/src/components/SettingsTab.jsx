import React, { useState } from "react";
import { API_URL } from "../utils/helpers";

export default function SettingsTab({
  meObj,
  darkMode,
  setDarkMode,
  authHeaders,
  onRefreshMe,
  onLogout,
}) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const handleToggleCloseFriend = async (username) => {
    const res = await fetch(`${API_URL}/users/close-friends/${username}`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) onRefreshMe();
  };

  const handleUnblock = async (username) => {
    const res = await fetch(`${API_URL}/users/${username}/block`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) onRefreshMe();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      setOldPassword("");
      setNewPassword("");
    } else {
      alert(data.detail || "Failed to update password");
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!window.confirm("Are you sure? This will permanently delete your account!")) return;
    const res = await fetch(`${API_URL}/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      onLogout();
    } else {
      alert(data.detail || "Failed to delete account");
    }
  };

  const followers = meObj?.followers || [];
  const closeFriends = meObj?.close_friends || [];
  const blockedUsers = meObj?.blocked_users || [];

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "24px auto",
        padding: "20px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-line)",
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      <h3>Settings & Privacy</h3>

      {/* 1. Theme */}
      <div>
        <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>Appearance</h4>
        <button className="ig-btn-gray" onClick={() => setDarkMode(!darkMode)}>
          Switch to {darkMode ? "Light ☀️" : "Dark 🌙"} Theme
        </button>
      </div>

      {/* 2. Close Friends Manager */}
      <div style={{ borderTop: "1px solid var(--border-line)", paddingTop: "16px" }}>
        <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>Close Friends 💚</h4>
        {followers.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            You don't have any followers yet to add to Close Friends.
          </p>
        ) : (
          followers.map((uname) => {
            const isCF = closeFriends.includes(uname);
            return (
              <div
                key={uname}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600" }}>{uname}</span>
                <button
                  className={isCF ? "ig-btn-blue" : "ig-btn-gray"}
                  style={isCF ? { background: "#1ed760", color: "#000" } : {}}
                  onClick={() => handleToggleCloseFriend(uname)}
                >
                  {isCF ? "Close Friend ✓" : "Add"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Blocked Users */}
      {blockedUsers.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-line)", paddingTop: "16px" }}>
          <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>Blocked Accounts 🚫</h4>
          {blockedUsers.map((uname) => (
            <div
              key={uname}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
            >
              <span style={{ fontSize: "14px" }}>{uname}</span>
              <button className="ig-btn-gray" onClick={() => handleUnblock(uname)}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 4. Change Password */}
      <form
        onSubmit={handleChangePassword}
        style={{ borderTop: "1px solid var(--border-line)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}
      >
        <h4 style={{ fontSize: "14px" }}>Change Password</h4>
        <input
          type="password"
          className="ig-input"
          placeholder="Current password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="ig-input"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button type="submit" className="ig-btn-blue">
          Update Password
        </button>
      </form>

      {/* 5. Permanently Delete Account */}
      <form
        onSubmit={handleDeleteAccount}
        style={{ borderTop: "1px solid var(--border-line)", paddingTop: "16px" }}
      >
        <h4 style={{ color: "#ff3040", marginBottom: "8px", fontSize: "14px" }}>Permanently Delete Account</h4>
        <input
          type="password"
          className="ig-input"
          placeholder="Enter your password to confirm"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          required
        />
        <button type="submit" className="ig-btn-blue" style={{ background: "#ff3040", marginTop: "10px", width: "100%" }}>
          Delete Account Forever
        </button>
      </form>
    </div>
  );
}