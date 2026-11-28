import React, { useState, useRef, useEffect } from "react";
import { API_URL, formatTimeAgo, formatChatTime, getOnlineStatus } from "../utils/helpers";
import { Icons } from "./Icons";

export default function MessagesTab({
  currentUser,
  meObj,
  allUsers,
  selectedChatUser,
  setSelectedChatUser,
  messages,
  fetchMessages,
  authHeaders,
  onOpenProfile,
  onStartCall,
  onRefreshUsers,
}) {
  const [newMessage, setNewMessage] = useState("");
  const [replyToMsg, setReplyToMsg] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState(meObj?.note?.text || "");
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const chatScrollRef = useRef(null);

  const activeChatLiveUser = selectedChatUser
    ? allUsers.find((u) => u.username === selectedChatUser.username) || selectedChatUser
    : null;

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Check if active chat partner is typing (within last 5 seconds)
  const isPartnerTyping = (() => {
    if (!activeChatLiveUser) return false;
    if (activeChatLiveUser.typing_to !== currentUser || !activeChatLiveUser.typing_at) return false;
    const diff = (Date.now() - new Date(activeChatLiveUser.typing_at).getTime()) / 1000;
    return diff >= 0 && diff <= 5;
  })();

  // Send typing indicator ping
  const notifyTyping = (typingState) => {
    if (!activeChatLiveUser) return;
    fetch(`${API_URL}/messages/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ to_user: activeChatLiveUser.username, is_typing: typingState }),
    }).catch(() => {});
  };

  const handleInputChange = (val) => {
    setNewMessage(val);
    notifyTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => notifyTyping(false), 2500);
  };

  // Save or Clear 24-hour Instagram Note
  const handleSaveNote = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/users/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ text: noteInput }),
    });
    if (res.ok) {
      setShowNoteModal(false);
      onRefreshUsers();
    }
  };

  // Send Text DM
  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatLiveUser) return;
    const textToSend = newMessage;
    setNewMessage("");
    notifyTyping(false);

    const res = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        receiver: activeChatLiveUser.username,
        text: textToSend,
        reply_to_text: replyToMsg || null,
      }),
    });
    if (res.ok) {
      setReplyToMsg("");
      fetchMessages(activeChatLiveUser.username);
    } else {
      const err = await res.json();
      alert(err.detail || "Cannot send message");
    }
  };

  // Send Photo in DM
  const handleSendChatImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatLiveUser) return;
    const formData = new FormData();
    formData.append("file", file);
    const upRes = await fetch(`${API_URL}/messages/upload-media`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    });
    if (upRes.ok) {
      const { media_url } = await upRes.json();
      await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ receiver: activeChatLiveUser.username, text: "", media_url }),
      });
      fetchMessages(activeChatLiveUser.username);
    }
  };

  // Record & Send Voice Note
  const handleToggleVoiceRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "voice-note.webm");
        const upRes = await fetch(`${API_URL}/messages/upload-media`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
        if (upRes.ok && activeChatLiveUser) {
          const { media_url } = await upRes.json();
          await fetch(`${API_URL}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              receiver: activeChatLiveUser.username,
              text: "🎤 Voice message",
              media_url,
            }),
          });
          fetchMessages(activeChatLiveUser.username);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone permission denied or unavailable.");
    }
  };

  const handleReactMsg = async (msgId, emoji) => {
    await fetch(`${API_URL}/messages/${msgId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ emoji }),
    });
    if (activeChatLiveUser) fetchMessages(activeChatLiveUser.username);
  };

  const handleUnsendMsg = async (msgId) => {
    await fetch(`${API_URL}/messages/${msgId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (activeChatLiveUser) fetchMessages(activeChatLiveUser.username);
  };

  // Connected users (followers, following, or existing chat history)
  const connectedUsers = allUsers.filter(
    (u) =>
      u.username !== currentUser &&
      (u.followers?.includes(currentUser) ||
        u.following?.includes(currentUser) ||
        Boolean(u.last_msg_text))
  );

  // Active 24-hour Notes from connected users
  const activeNotesUsers = connectedUsers.filter(
    (u) => u.note?.text && (!u.note.expires_at || new Date(u.note.expires_at) > new Date())
  );

  const isMyNoteActive =
    meObj?.note?.text && (!meObj.note.expires_at || new Date(meObj.note.expires_at) > new Date());

  return (
    <div className={`ig-inbox ${activeChatLiveUser ? "chat-open" : ""}`}>
      {/* LEFT PANE: NOTES + INBOX LIST */}
      <div className="ig-inbox-list">
        <div
          style={{
            padding: "16px 18px",
            fontWeight: "700",
            borderBottom: "1px solid var(--border-line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{currentUser}</span>
          <button
            className="ig-link-btn"
            style={{ fontSize: "12px" }}
            onClick={() => {
              setNoteInput(isMyNoteActive ? meObj.note.text : "");
              setShowNoteModal(true);
            }}
          >
            + Note
          </button>
        </div>

        {/* 24-HOUR INSTAGRAM NOTES STRIP */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            padding: "14px 16px 10px",
            overflowX: "auto",
            borderBottom: "1px solid var(--border-line)",
          }}
        >
          {/* Current User's Note Bubble */}
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "66px", cursor: "pointer" }}
            onClick={() => {
              setNoteInput(isMyNoteActive ? meObj.note.text : "");
              setShowNoteModal(true);
            }}
          >
            <div
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-line)",
                borderRadius: "12px",
                padding: "4px 8px",
                fontSize: "11px",
                maxWidth: "74px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginBottom: "-6px",
                zIndex: 2,
                color: isMyNoteActive ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              {isMyNoteActive ? meObj.note.text : "Note..."}
            </div>
            <div className="ig-avatar-44">{currentUser[0]}</div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Your note</span>
          </div>

          {/* Friends' Notes */}
          {activeNotesUsers.map((u) => (
            <div
              key={u._id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "66px", cursor: "pointer" }}
              onClick={() => {
                setSelectedChatUser(u);
                fetchMessages(u.username);
              }}
            >
              <div
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-line)",
                  borderRadius: "12px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  maxWidth: "74px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginBottom: "-6px",
                  zIndex: 2,
                }}
              >
                {u.note.text}
              </div>
              <div className="ig-avatar-44">{u.username[0]}</div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{u.username}</span>
            </div>
          ))}
        </div>

        {/* CHAT THREADS LIST */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {connectedUsers.length === 0 ? (
            <p style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              Follow people to start messaging them.
            </p>
          ) : (
            connectedUsers.map((u) => {
              const isFollowing = u.followers?.includes(currentUser) || meObj?.following?.includes(u.username);
              const statusInfo = getOnlineStatus(u.last_seen);
              return (
                <div
                  key={u._id}
                  className={`ig-thread-row ${activeChatLiveUser?.username === u.username ? "active" : ""}`}
                  onClick={() => {
                    setSelectedChatUser(u);
                    fetchMessages(u.username);
                  }}
                >
                  <div className="avatar-status-wrap">
                    <div className="ig-avatar-44">{u.username[0]}</div>
                    {isFollowing && statusInfo.isOnline && <span className="online-green-dot" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", fontSize: "14px" }}>{u.username}</span>
                      {u.last_msg_time && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {formatTimeAgo(u.last_msg_time)}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: statusInfo.isOnline && isFollowing ? "#1ed760" : "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.last_msg_text ? u.last_msg_text : isFollowing ? statusInfo.label : "Tap to chat"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: ACTIVE CONVERSATION */}
      <div className="ig-chat-pane">
        {activeChatLiveUser ? (
          <>
            <div className="ig-chat-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button className="mobile-back-btn" onClick={() => setSelectedChatUser(null)}>
                  ←
                </button>
                <div className="avatar-status-wrap">
                  <div className="ig-avatar-32">{activeChatLiveUser.username[0]}</div>
                  {getOnlineStatus(activeChatLiveUser.last_seen).isOnline && <span className="online-green-dot" />}
                </div>
                <div>
                  <div
                    style={{ fontWeight: "600", fontSize: "14px", cursor: "pointer" }}
                    onClick={() => onOpenProfile(activeChatLiveUser.username)}
                  >
                    {activeChatLiveUser.username}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: isPartnerTyping || getOnlineStatus(activeChatLiveUser.last_seen).isOnline
                        ? "#1ed760"
                        : "var(--text-muted)",
                    }}
                  >
                    {isPartnerTyping ? "typing..." : getOnlineStatus(activeChatLiveUser.last_seen).label}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button className="ig-svg-btn" title="Audio Call" onClick={() => onStartCall(activeChatLiveUser, "audio")}>
                  <Icons.Phone />
                </button>
                <button className="ig-svg-btn" title="Video Call" onClick={() => onStartCall(activeChatLiveUser, "video")}>
                  <Icons.VideoCall />
                </button>
              </div>
            </div>

            {/* MESSAGES SCROLL AREA */}
            <div className="ig-chat-scroll" ref={chatScrollRef}>
              {messages.map((m) => {
                const isMe = m.sender === currentUser;
                const isAudio = m.media_url && (m.media_url.includes(".webm") || m.text === "🎤 Voice message");

                return (
                  <div key={m._id} className={`ig-bubble-wrap ${isMe ? "me" : "them"}`}>
                    {m.reply_to_text && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>
                        Replied to: {m.reply_to_text}
                      </div>
                    )}

                    {/* Shared Post Preview Card */}
                    {m.shared_post ? (
                      <div
                        onClick={() => onOpenProfile(m.shared_post.username)}
                        style={{
                          width: "220px",
                          borderRadius: "14px",
                          overflow: "hidden",
                          border: "1px solid var(--border-line)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ padding: "8px 10px", fontWeight: "700", fontSize: "12px" }}>
                          @{m.shared_post.username}
                        </div>
                        {m.shared_post.media_type === "video" ? (
                          <video src={m.shared_post.media_url} style={{ width: "100%", maxHeight: "220px", objectFit: "cover" }} />
                        ) : (
                          <img src={m.shared_post.media_url} alt="Shared post" style={{ width: "100%", maxHeight: "220px", objectFit: "cover" }} />
                        )}
                        {m.shared_post.caption && (
                          <div style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-muted)" }}>
                            {m.shared_post.caption}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`ig-bubble ${isMe ? "me" : "them"}`}>
                        {m.media_url && isAudio && (
                          <audio controls src={m.media_url} style={{ maxWidth: "210px", height: "34px" }} />
                        )}
                        {m.media_url && !isAudio && (
                          <img
                            src={m.media_url}
                            alt="Chat media"
                            style={{ maxWidth: "200px", borderRadius: "10px", display: "block", marginBottom: m.text ? "6px" : "0" }}
                          />
                        )}
                        {!isAudio && m.text}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        marginTop: "3px",
                        alignItems: "center",
                      }}
                    >
                      {m.created_at && <span>{formatChatTime(m.created_at)}</span>}
                      {m.reactions?.map((r, i) => (
                        <span key={i}>{r.emoji}</span>
                      ))}
                      <span style={{ cursor: "pointer" }} onClick={() => handleReactMsg(m._id, "❤️")}>
                        ❤️
                      </span>
                      <span style={{ cursor: "pointer" }} onClick={() => setReplyToMsg(m.text || "Shared post")}>
                        Reply
                      </span>
                      {isMe && (
                        <span style={{ cursor: "pointer", color: "#ff3040" }} onClick={() => handleUnsendMsg(m._id)}>
                          Unsend
                        </span>
                      )}
                      {isMe && m.seen && <span>• Seen</span>}
                    </div>
                  </div>
                );
              })}

              {isPartnerTyping && (
                <div style={{ fontSize: "12px", color: "#1ed760", padding: "4px 8px" }}>
                  {activeChatLiveUser.username} is typing...
                </div>
              )}
            </div>

            {replyToMsg && (
              <div
                style={{
                  padding: "6px 18px",
                  background: "var(--bg-hover)",
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span>
                  Replying to: <strong>{replyToMsg}</strong>
                </span>
                <span style={{ cursor: "pointer" }} onClick={() => setReplyToMsg("")}>
                  ✕
                </span>
              </div>
            )}

            {/* MESSAGE INPUT + IMAGE + VOICE RECORDER */}
            <form className="ig-chat-pill" onSubmit={handleSendDM}>
              <label style={{ cursor: "pointer", fontSize: "18px" }} title="Send Photo">
                🖼️
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleSendChatImage} />
              </label>

              <button
                type="button"
                onClick={handleToggleVoiceRecord}
                title={isRecording ? "Stop & Send Voice Note" : "Record Voice Note"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isRecording ? "#ff3040" : "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Icons.Mic />
              </button>

              <input
                placeholder={isRecording ? "Recording audio... Tap mic to send" : "Message..."}
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={isRecording}
              />
              {newMessage.trim() && (
                <button type="submit" className="ig-link-btn">
                  Send
                </button>
              )}
            </form>
          </>
        ) : (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)" }}>
            <h3>Your Messages</h3>
            <p style={{ fontSize: "13px" }}>Share notes, voice messages, posts, or start a live video call.</p>
          </div>
        )}
      </div>

      {/* NOTE MODAL */}
      {showNoteModal && (
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
          onClick={() => setShowNoteModal(false)}
        >
          <form
            onSubmit={handleSaveNote}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-line)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "340px",
              padding: "18px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700" }}>Share a 24h Note</span>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <input
              className="ig-input"
              maxLength={60}
              placeholder="What's on your mind? (max 60 chars)"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="submit" className="ig-btn-blue" style={{ flex: 1 }}>
                Share Note
              </button>
              {isMyNoteActive && (
                <button
                  type="button"
                  className="ig-btn-gray"
                  style={{ color: "#ff3040" }}
                  onClick={() => {
                    setNoteInput("");
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}