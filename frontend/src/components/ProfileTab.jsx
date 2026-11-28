import React, { useState, useEffect } from "react";
import { API_URL, formatTimeAgo, getOnlineStatus } from "../utils/helpers";

export default function ProfileTab({
  profileData,
  currentUser,
  viewedUsername,
  authHeaders,
  onOpenProfile,
  onFollow,
  onBlockUser,
  onStartCall,
  onOpenChat,
  onOpenSettings,
  onLogout,
  onRefreshMe,
}) {
  const [subTab, setSubTab] = useState("posts");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: profileData?.user?.full_name || "",
    bio: profileData?.user?.bio || "",
    is_private: profileData?.user?.is_private || false,
  });
  const [archivedStories, setArchivedStories] = useState([]);
  const [listModal, setListModal] = useState(null); // { title: "Followers", users: [] }

  const isOwnProfile =
    viewedUsername?.trim().toLowerCase() === currentUser?.trim().toLowerCase() ||
    profileData?.user?.username?.trim().toLowerCase() === currentUser?.trim().toLowerCase();

  useEffect(() => {
    setEditForm({
      full_name: profileData?.user?.full_name || "",
      bio: profileData?.user?.bio || "",
      is_private: profileData?.user?.is_private || false,
    });
    setIsEditing(false);
    setSubTab("posts");
  }, [profileData?.user?.username]);

  const fetchArchive = async () => {
    const res = await fetch(`${API_URL}/stories/archive`, { headers: authHeaders });
    if (res.ok) setArchivedStories(await res.json());
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/users/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setIsEditing(false);
      onOpenProfile(currentUser);
      onRefreshMe();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/users/profile-pic`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (res.ok) {
      onOpenProfile(currentUser);
      onRefreshMe();
    }
  };

  const handleAddHighlight = async (storyId) => {
    const title = window.prompt("Enter Highlight Title (e.g. Trips, College, Vibes):");
    if (!title || !title.trim()) return;
    const res = await fetch(`${API_URL}/users/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ story_id: storyId, title: title.trim() }),
    });
    if (res.ok) {
      alert("Added to Story Highlights!");
      onOpenProfile(currentUser);
    }
  };

  if (!profileData) return null;
  const { user, can_view, posts = [], saved_posts = [], tagged_posts = [] } = profileData;

  return (
    <div className="ig-profile-container">
      {/* TOP PROFILE INFO */}
      <div className="ig-profile-top">
        <div>
          {user.profile_pic ? (
            <img src={user.profile_pic} alt="DP" className="ig-dp-150" />
          ) : (
            <div className="ig-dp-150">{user.username[0]}</div>
          )}
          {isOwnProfile && (
            <label
              style={{
                display: "block",
                textAlign: "center",
                color: "#0095f6",
                fontSize: "13px",
                fontWeight: "600",
                marginTop: "8px",
                cursor: "pointer",
              }}
            >
              Change photo
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
            </label>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "20px", fontWeight: "600" }}>{user.username}</span>
            {user.is_private && (
              <span style={{ fontSize: "12px", background: "var(--bg-input)", padding: "2px 8px", borderRadius: "12px" }}>
                🔒 Private
              </span>
            )}
            {!isOwnProfile && (
              <span
                style={{
                  fontSize: "12px",
                  color: getOnlineStatus(user.last_seen).isOnline ? "#1ed760" : "var(--text-muted)",
                }}
              >
                • {getOnlineStatus(user.last_seen).label}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
            {isOwnProfile ? (
              <>
                <button className="ig-btn-gray" onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? "Cancel" : "Edit profile"}
                </button>
                <button className="ig-btn-gray" onClick={onOpenSettings} title="Settings">
                  ⚙️
                </button>
                <button className="ig-btn-gray" style={{ color: "#ff3040" }} onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  className={user.followers?.includes(currentUser) ? "ig-btn-gray" : "ig-btn-blue"}
                  onClick={() => onFollow(user.username)}
                >
                  {user.followers?.includes(currentUser)
                    ? "Following"
                    : user.follow_requests?.includes(currentUser)
                    ? "Requested"
                    : "Follow"}
                </button>
                {can_view && (
                  <>
                    <button className="ig-btn-gray" onClick={() => onOpenChat(user)}>
                      Message
                    </button>
                    <button className="ig-btn-gray" onClick={() => onStartCall(user, "video")}>
                      📹 Call
                    </button>
                  </>
                )}
                <button className="ig-btn-gray" style={{ color: "#ff3040" }} onClick={() => onBlockUser(user.username)}>
                  Block
                </button>
              </>
            )}
          </div>

          <div className="ig-stats-row">
            <span>
              <strong>{posts.length}</strong> posts
            </span>
            <span
              style={{ cursor: can_view ? "pointer" : "default" }}
              onClick={() => can_view && setListModal({ title: "Followers", users: user.followers || [] })}
            >
              <strong>{user.followers?.length || 0}</strong> followers
            </span>
            <span
              style={{ cursor: can_view ? "pointer" : "default" }}
              onClick={() => can_view && setListModal({ title: "Following", users: user.following || [] })}
            >
              <strong>{user.following?.length || 0}</strong> following
            </span>
          </div>

          <div style={{ marginTop: "10px", fontSize: "14px" }}>
            <div style={{ fontWeight: "700" }}>{user.full_name}</div>
            <div style={{ color: "var(--text-muted)" }}>{user.bio}</div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE FORM */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          style={{ maxWidth: "400px", margin: "16px auto", display: "flex", flexDirection: "column", gap: "10px" }}
        >
          <input
            className="ig-input"
            placeholder="Full Name"
            value={editForm.full_name}
            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
          />
          <input
            className="ig-input"
            placeholder="Bio"
            value={editForm.bio}
            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
          />
          <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={editForm.is_private}
              onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })}
            />
            Private Account 🔒
          </label>
          <button type="submit" className="ig-btn-blue">
            Save Profile
          </button>
        </form>
      )}

      {/* STORY HIGHLIGHTS ROW */}
      {can_view && user.highlights?.length > 0 && (
        <div style={{ display: "flex", gap: "18px", padding: "12px 6px", overflowX: "auto" }}>
          {user.highlights.map((hl, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "68px" }}>
              <img
                src={hl.cover_url}
                alt={hl.title}
                style={{
                  width: "62px",
                  height: "62px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--border-line)",
                }}
              />
              <span style={{ fontSize: "11px", marginTop: "5px" }}>{hl.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* PRIVATE LOCK OR TABS */}
      {!can_view ? (
        <div style={{ textAlign: "center", padding: "40px", borderTop: "1px solid var(--border-line)" }}>
          <h4>🔒 This Account is Private</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Follow this account to see their photos and videos.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "24px",
              borderTop: "1px solid var(--border-line)",
              padding: "12px 0",
              marginTop: "16px",
              fontSize: "13px",
            }}
          >
            <span
              style={{ cursor: "pointer", fontWeight: subTab === "posts" ? "700" : "400" }}
              onClick={() => setSubTab("posts")}
            >
              POSTS
            </span>
            {isOwnProfile && (
              <>
                <span
                  style={{ cursor: "pointer", fontWeight: subTab === "saved" ? "700" : "400" }}
                  onClick={() => setSubTab("saved")}
                >
                  SAVED
                </span>
                <span
                  style={{ cursor: "pointer", fontWeight: subTab === "archive" ? "700" : "400" }}
                  onClick={() => {
                    setSubTab("archive");
                    fetchArchive();
                  }}
                >
                  ARCHIVE
                </span>
              </>
            )}
            <span
              style={{ cursor: "pointer", fontWeight: subTab === "tagged" ? "700" : "400" }}
              onClick={() => setSubTab("tagged")}
            >
              TAGGED
            </span>
          </div>

          {subTab === "archive" ? (
            <div className="ig-grid-3">
              {archivedStories.length === 0 ? (
                <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: "30px" }}>
                  No archived stories yet.
                </p>
              ) : (
                archivedStories.map((st) => (
                  <div key={st._id} className="ig-grid-item" style={{ position: "relative" }}>
                    {st.media_type === "video" ? <video src={st.media_url} muted /> : <img src={st.media_url} alt="Archive" />}
                    <button
                      onClick={() => handleAddHighlight(st._id)}
                      style={{
                        position: "absolute",
                        bottom: "6px",
                        left: "6px",
                        right: "6px",
                        background: "rgba(0,0,0,0.75)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "4px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      + Highlight
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="ig-grid-3">
              {(subTab === "posts" ? posts : subTab === "saved" ? saved_posts : tagged_posts).map((p) => (
                <div key={p._id} className="ig-grid-item">
                  {p.media_type === "video" ? <video src={p.media_url} muted /> : <img src={p.media_url} alt="Post" />}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* FOLLOWERS / FOLLOWING LIST MODAL */}
      {listModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setListModal(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-line)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "350px",
              maxHeight: "420px",
              overflowY: "auto",
              padding: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700" }}>{listModal.title}</span>
              <button
                onClick={() => setListModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            {listModal.users.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No users found.</p>
            ) : (
              listModal.users.map((uname) => (
                <div
                  key={uname}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", cursor: "pointer" }}
                  onClick={() => {
                    setListModal(null);
                    onOpenProfile(uname);
                  }}
                >
                  <div className="ig-avatar-32">{uname[0]}</div>
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>{uname}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}