import React, { useState } from "react";
import { API_URL, formatTimeAgo } from "../utils/helpers";
import { Icons } from "./Icons";

export default function FeedPostCard({
  post,
  currentUser,
  meObj,
  allUsers,
  authHeaders,
  onOpenProfile,
  onRefreshFeed,
  onRefreshMe,
}) {
  const [commentText, setCommentText] = useState("");
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [sharedSentTo, setSharedSentTo] = useState([]);

  const isLiked = post.likes?.includes(currentUser);
  const isSaved = meObj?.saved_posts?.includes(post._id);
  const isFollowing = meObj?.following?.includes(post.username);

  const handleToggleLike = async () => {
    await fetch(`${API_URL}/posts/${post._id}/like`, {
      method: "POST",
      headers: authHeaders,
    });
    onRefreshFeed();
  };

  const handleDoubleTap = () => {
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 750);
    if (!isLiked) handleToggleLike();
  };

  const handleToggleSave = async () => {
    await fetch(`${API_URL}/posts/${post._id}/save`, {
      method: "POST",
      headers: authHeaders,
    });
    onRefreshMe();
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await fetch(`${API_URL}/posts/${post._id}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ text: commentText }),
    });
    setCommentText("");
    onRefreshFeed();
  };

  const handleVotePoll = async (optionIndex) => {
    await fetch(`${API_URL}/posts/${post._id}/vote/${optionIndex}`, {
      method: "POST",
      headers: authHeaders,
    });
    onRefreshFeed();
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Delete this post?")) return;
    await fetch(`${API_URL}/posts/${post._id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    onRefreshFeed();
  };

  // Share post directly into a user's DM chat
  const handleSendPostInDM = async (targetUsername) => {
    const res = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        receiver: targetUsername,
        text: `Shared a post by @${post.username}`,
        shared_post: {
          _id: post._id,
          username: post.username,
          media_url: post.media_url,
          media_type: post.media_type,
          caption: post.caption || "",
        },
      }),
    });
    if (res.ok) {
      setSharedSentTo((prev) => [...prev, targetUsername]);
    } else {
      const err = await res.json();
      alert(err.detail || "Could not share post");
    }
  };

  const shareableUsers = (allUsers || []).filter(
    (u) =>
      u.username !== currentUser &&
      (u.followers?.includes(currentUser) || u.following?.includes(currentUser)) &&
      u.username.toLowerCase().includes(shareSearch.toLowerCase())
  );

  return (
    <article className="ig-post-card">
      {/* Post Header */}
      <div className="ig-post-header">
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          onClick={() => onOpenProfile(post.username)}
        >
          <div className="ig-avatar-32">{post.username[0]}</div>
          <div>
            <div style={{ fontWeight: "600", fontSize: "14px" }}>
              {post.username}
              {post.location && (
                <span style={{ fontWeight: "400", fontSize: "12px", color: "var(--text-muted)" }}>
                  {" "}• {post.location}
                </span>
              )}
            </div>
            {post.music_title && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>🎵 {post.music_title}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {formatTimeAgo(post.created_at)}
          </span>
          {post.username === currentUser && (
            <button
              onClick={handleDeletePost}
              style={{ background: "none", border: "none", color: "#ff3040", fontSize: "12px", cursor: "pointer" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Post Media (Double-Tap to Like) */}
      <div className="ig-post-media-wrap" onDoubleClick={handleDoubleTap}>
        {post.media_type === "video" ? (
          <video src={post.media_url} controls playsInline className="ig-post-media" />
        ) : (
          <img src={post.media_url} alt="Post" className="ig-post-media" />
        )}
        {showHeartBurst && <div className="heart-burst-overlay">❤️</div>}
      </div>

      {/* Action Buttons Row */}
      <div className="ig-post-actions">
        <div className="ig-post-actions-left">
          <button className="ig-svg-btn" onClick={handleToggleLike} title="Like">
            <Icons.Heart filled={isLiked} />
          </button>
          <button
            className="ig-svg-btn"
            onClick={() => document.getElementById(`cmt-${post._id}`)?.focus()}
            title="Comment"
          >
            <Icons.Comment />
          </button>
          <button
            className="ig-svg-btn"
            onClick={() => {
              setSharedSentTo([]);
              setShowShareModal(true);
            }}
            title="Share in DM"
          >
            <Icons.Share />
          </button>
        </div>
        <button className="ig-svg-btn" onClick={handleToggleSave} title="Save">
          <Icons.Bookmark filled={isSaved} />
        </button>
      </div>

      {/* Likes Count (Clickable to view Liked-By List) */}
      <div style={{ padding: "0 12px" }}>
        <span
          style={{ fontWeight: "700", fontSize: "14px", cursor: "pointer" }}
          onClick={() => post.likes?.length > 0 && setShowLikesModal(true)}
        >
          {post.likes?.length || 0} likes
        </span>
      </div>

      {/* Caption */}
      {post.caption && (
        <div style={{ padding: "4px 12px", fontSize: "14px" }}>
          <span
            style={{ fontWeight: "700", marginRight: "6px", cursor: "pointer" }}
            onClick={() => onOpenProfile(post.username)}
          >
            {post.username}
          </span>
          <span>{post.caption}</span>
        </div>
      )}

      {/* Interactive Poll (if attached) */}
      {post.poll_question && post.poll_options?.length > 0 && (
        <div
          style={{
            margin: "8px 12px",
            padding: "10px",
            borderRadius: "10px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-line)",
          }}
        >
          <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px" }}>
            📊 {post.poll_question}
          </div>
          {post.poll_options.map((opt, idx) => {
            const totalVotes = post.poll_options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
            const pct = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
            const votedMe = opt.votes?.includes(currentUser);
            return (
              <div
                key={idx}
                onClick={() => handleVotePoll(idx)}
                style={{
                  padding: "7px 10px",
                  marginBottom: "6px",
                  borderRadius: "8px",
                  border: votedMe ? "1px solid #0095f6" : "1px solid var(--border-line)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  background: votedMe ? "rgba(0,149,246,0.12)" : "transparent",
                }}
              >
                <span>{opt.text} {votedMe && "✓"}</span>
                <span style={{ fontWeight: "600" }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Comments List with Reply Button */}
      <div style={{ padding: "4px 12px" }}>
        {post.comments?.map((c, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              marginBottom: "4px",
            }}
          >
            <div>
              <span
                style={{ fontWeight: "700", marginRight: "6px", cursor: "pointer" }}
                onClick={() => onOpenProfile(c.username)}
              >
                {c.username}
              </span>
              <span>{c.text}</span>
            </div>
            <span
              style={{ fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", marginLeft: "8px" }}
              onClick={() => {
                setCommentText(`@${c.username} `);
                document.getElementById(`cmt-${post._id}`)?.focus();
              }}
            >
              Reply
            </span>
          </div>
        ))}
      </div>

      {/* Add Comment Input */}
      <form
        onSubmit={handleAddComment}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderTop: "1px solid var(--border-line)",
          marginTop: "6px",
        }}
      >
        <input
          id={`cmt-${post._id}`}
          placeholder="Add a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            color: "var(--text-main)",
            outline: "none",
            fontSize: "13px",
          }}
        />
        {commentText.trim() && (
          <button type="submit" className="ig-link-btn">
            Post
          </button>
        )}
      </form>

      {/* MODAL 1: Liked By List */}
      {showLikesModal && (
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
          onClick={() => setShowLikesModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-line)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "360px",
              maxHeight: "420px",
              overflowY: "auto",
              padding: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700", fontSize: "16px" }}>Likes</span>
              <button
                onClick={() => setShowLikesModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            {post.likes.map((uname) => (
              <div
                key={uname}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setShowLikesModal(false);
                  onOpenProfile(uname);
                }}
              >
                <div className="ig-avatar-32">{uname[0]}</div>
                <span style={{ fontWeight: "600", fontSize: "14px" }}>{uname}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 2: Share Post Directly in DM */}
      {showShareModal && (
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
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-line)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "380px",
              maxHeight: "460px",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontWeight: "700", fontSize: "16px" }}>Share to</span>
              <button
                onClick={() => setShowShareModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <input
              className="ig-input"
              placeholder="Search people..."
              value={shareSearch}
              onChange={(e) => setShareSearch(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <div style={{ flex: 1, overflowY: "auto" }}>
              {shareableUsers.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
                  Follow people to share posts directly with them.
                </p>
              ) : (
                shareableUsers.map((u) => {
                  const isSent = sharedSentTo.includes(u.username);
                  return (
                    <div
                      key={u._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="ig-avatar-32">{u.username[0]}</div>
                        <span style={{ fontWeight: "600", fontSize: "14px" }}>{u.username}</span>
                      </div>
                      <button
                        className={isSent ? "ig-btn-gray" : "ig-btn-blue"}
                        disabled={isSent}
                        onClick={() => handleSendPostInDM(u.username)}
                      >
                        {isSent ? "Sent ✓" : "Send"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}