import React, { useState } from "react";
import { API_URL, formatTimeAgo } from "../utils/helpers";
import { Icons } from "./Icons";

export default function StoriesBar({
  stories,
  currentUser,
  authHeaders,
  onRefreshStories,
  onOpenProfile,
  onOpenCreateStory,
}) {
  const [activeStory, setActiveStory] = useState(null);

  const handleViewStory = async (story) => {
    setActiveStory(story);
    if (story.username !== currentUser && !story.viewers?.includes(currentUser)) {
      await fetch(`${API_URL}/stories/${story._id}/view`, {
        method: "POST",
        headers: authHeaders,
      });
      onRefreshStories();
    }
  };

  const handleLikeStory = async (storyId) => {
    const res = await fetch(`${API_URL}/stories/${storyId}/like`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) {
      const updated = await res.json();
      setActiveStory((prev) => (prev ? { ...prev, likes: updated.likes } : null));
      onRefreshStories();
    }
  };

  const handleDeleteStory = async (storyId) => {
    if (!window.confirm("Delete this story?")) return;
    const res = await fetch(`${API_URL}/stories/${storyId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (res.ok) {
      setActiveStory(null);
      onRefreshStories();
    }
  };

  return (
    <>
      <div className="ig-stories-row">
        {/* Add Story Button */}
        <div className="ig-story-item" onClick={onOpenCreateStory}>
          <div
            className="ig-story-ring"
            style={{ background: "var(--border-line)", position: "relative" }}
          >
            <div className="ig-story-inner" style={{ fontSize: "24px", fontWeight: "400" }}>
              +
            </div>
          </div>
          <span className="ig-story-name">Your story</span>
        </div>

        {/* Active 24h Stories */}
        {stories.map((st) => {
          const isViewed = st.viewers?.includes(currentUser) || st.username === currentUser;
          return (
            <div key={st._id} className="ig-story-item" onClick={() => handleViewStory(st)}>
              <div
                className="ig-story-ring"
                style={{
                  background: st.close_friends_only
                    ? "#1ed760"
                    : isViewed
                    ? "var(--border-line)"
                    : undefined,
                }}
              >
                <div className="ig-story-inner">{st.username[0]}</div>
              </div>
              <span className="ig-story-name">{st.username}</span>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              height: "85vh",
              position: "relative",
              background: "#111",
              borderRadius: "14px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* Top Header */}
            <div
              style={{
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                zIndex: 2,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                onClick={() => {
                  setActiveStory(null);
                  onOpenProfile(activeStory.username);
                }}
              >
                <div className="ig-avatar-32">{activeStory.username[0]}</div>
                <span style={{ fontWeight: "600", fontSize: "14px" }}>{activeStory.username}</span>
                <span style={{ fontSize: "12px", color: "#ccc" }}>
                  {formatTimeAgo(activeStory.created_at)}
                </span>
                {activeStory.close_friends_only && (
                  <span
                    style={{
                      background: "#1ed760",
                      color: "#000",
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "8px",
                    }}
                  >
                    Close Friends
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {activeStory.username === currentUser && (
                  <button
                    onClick={() => handleDeleteStory(activeStory._id)}
                    style={{ background: "none", border: "none", color: "#ff3040", cursor: "pointer", fontSize: "13px" }}
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setActiveStory(null)}
                  style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Story Media */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {activeStory.media_type === "video" ? (
                <video src={activeStory.media_url} autoPlay loop controls style={{ width: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <img src={activeStory.media_url} alt="Story" style={{ width: "100%", maxHeight: "100%", objectFit: "contain" }} />
              )}
            </div>

            {/* Bottom Caption + Like / Viewers */}
            <div style={{ padding: "14px", background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
              {activeStory.caption && (
                <p style={{ textAlign: "center", fontSize: "14px", marginBottom: "10px" }}>{activeStory.caption}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {activeStory.username === currentUser ? (
                  <span style={{ fontSize: "12px", color: "#ccc" }}>
                    👁️ Viewed by {activeStory.viewers?.length || 0} • ❤️ {activeStory.likes?.length || 0}
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "#aaa" }}>Tap heart to react</span>
                )}
                <button
                  onClick={() => handleLikeStory(activeStory._id)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <Icons.Heart filled={activeStory.likes?.includes(currentUser)} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}