import React, { useState, useEffect, useRef } from "react";
import { API_URL, formatTimeAgo } from "./utils/helpers";
import { Icons } from "./components/Icons";
import AuthPage from "./components/AuthPage";
import StoriesBar from "./components/StoriesBar";
import FeedPostCard from "./components/FeedPostCard";
import MessagesTab from "./components/MessagesTab";
import ProfileTab from "./components/ProfileTab";
import SettingsTab from "./components/SettingsTab";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(
    (localStorage.getItem("username") || "").trim().toLowerCase()
  );

  // Navigation & Theme
  const [activeTab, setActiveTab] = useState("home");
  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "dark");

  // Core Data States
  const [meObj, setMeObj] = useState(null);
  const [feedPosts, setFeedPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [stories, setStories] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Search & Explore
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], posts: [] });

  // Create Post / Story States
  const [createMode, setCreateMode] = useState("post");
  const [createFiles, setCreateFiles] = useState([]);
  const [createCaption, setCreateCaption] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [isReelUpload, setIsReelUpload] = useState(false);
  const [storyMusic, setStoryMusic] = useState("");
  const [storyCloseFriends, setStoryCloseFriends] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Messages States
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [messages, setMessages] = useState([]);

  // Profile State
  const [viewedUsername, setViewedUsername] = useState("");
  const [profileData, setProfileData] = useState(null);

  // WebRTC Audio / Video Call States
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatusText, setCallStatusText] = useState("");
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Theme Toggle Effect
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Data Fetchers
  const fetchMe = async () => {
    if (!token || !currentUser) return;
    const res = await fetch(`${API_URL}/users/${currentUser}`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setMeObj(data.user);
    }
  };

  const fetchFeed = async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/posts`, { headers: authHeaders });
    if (res.ok) setFeedPosts(await res.json());
  };

  const fetchReels = async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/reels`, { headers: authHeaders });
    if (res.ok) setReels(await res.json());
  };

  const fetchStories = async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/stories`, { headers: authHeaders });
    if (res.ok) setStories(await res.json());
  };

  const fetchAllUsers = async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/users/search?q=`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.users || []);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/notifications`, { headers: authHeaders });
    if (res.ok) setNotifications(await res.json());
  };

  const fetchMessages = async (otherUser) => {
    if (!token || !otherUser) return;
    const res = await fetch(`${API_URL}/messages/${otherUser}`, { headers: authHeaders });
    if (res.ok) setMessages(await res.json());
  };

  // Initial Load & Background Polling
  useEffect(() => {
    if (!token) return;
    fetchMe();
    fetchFeed();
    fetchStories();
    fetchAllUsers();
    fetchNotifications();

    const interval = setInterval(() => {
      fetch(`${API_URL}/users/ping`, { method: "POST", headers: authHeaders }).catch(() => {});
      fetchAllUsers();
      if (selectedChatUser) fetchMessages(selectedChatUser.username);
      if (!activeCall) {
        fetch(`${API_URL}/calls/incoming`, { headers: authHeaders })
          .then((r) => (r.ok ? r.json() : null))
          .then((call) => setIncomingCall(call))
          .catch(() => {});
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [token, currentUser, selectedChatUser, activeCall]);

  // Search Handler
  const handleSearch = async (q) => {
    setSearchQuery(q);
    const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders,
    });
    if (res.ok) setSearchResults(await res.json());
  };

  // Open Profile Helper
  const openProfile = async (targetUsername) => {
    if (!targetUsername) return;
    const cleanTarget = targetUsername.trim().toLowerCase();
    setViewedUsername(cleanTarget);
    setActiveTab("profile");

    const res = await fetch(`${API_URL}/users/${cleanTarget}`, { headers: authHeaders });
    if (res.ok) {
      setProfileData(await res.json());
    } else {
      const err = await res.json();
      alert(err.detail || "Cannot open profile");
    }
  };

  // Follow / Unfollow Handler
  const handleFollow = async (targetUsername) => {
    const res = await fetch(`${API_URL}/users/${targetUsername}/follow`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) {
      fetchMe();
      fetchAllUsers();
      if (activeTab === "profile") openProfile(targetUsername);
    }
  };

  // Accept Follow Request
  const handleAcceptRequest = async (requester) => {
    const res = await fetch(`${API_URL}/users/follow-requests/${requester}/accept`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) {
      fetchMe();
      fetchNotifications();
    }
  };

  // Block / Unblock User
  const handleBlockUser = async (targetUsername) => {
    const res = await fetch(`${API_URL}/users/${targetUsername}/block`, {
      method: "POST",
      headers: authHeaders,
    });
    if (res.ok) {
      alert("Block status updated.");
      fetchMe();
      fetchAllUsers();
      setActiveTab("home");
    }
  };

  // Create Post or Story Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createFiles.length === 0) return alert("Please select a photo or video.");
    setIsUploading(true);
    try {
      const formData = new FormData();
      if (createMode === "story") {
        formData.append("file", createFiles[0]);
        formData.append("caption", createCaption);
        formData.append("music_name", storyMusic);
        formData.append("close_friends_only", storyCloseFriends);
        const res = await fetch(`${API_URL}/stories`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
        if (res.ok) {
          fetchStories();
          setActiveTab("home");
        }
      } else {
        createFiles.forEach((f) => formData.append("files", f));
        formData.append("caption", createCaption);
        formData.append("location", createLocation);
        formData.append("is_reel", isReelUpload);
        const res = await fetch(`${API_URL}/posts`, {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });
        if (res.ok) {
          fetchFeed();
          setActiveTab("home");
        }
      }
      setCreateFiles([]);
      setCreateCaption("");
      setCreateLocation("");
      setStoryMusic("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken("");
    setCurrentUser("");
    setMeObj(null);
  };

  // --- WEBRTC CALLING LOGIC ---
  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatusText("");
  };

  const startCall = async (targetUser, callType = "video") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`${API_URL}/calls/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          callee: targetUser.username,
          call_type: callType,
          offer: { type: offer.type, sdp: offer.sdp },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        cleanupCall();
        return alert(err.detail || "Cannot start call");
      }

      const { call_id } = await res.json();
      setActiveCall({ id: call_id, peer: targetUser.username, call_type: callType });
      setCallStatusText("Calling...");
      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 200);

      const pollAnswer = setInterval(async () => {
        const stRes = await fetch(`${API_URL}/calls/${call_id}`, { headers: authHeaders });
        if (!stRes.ok) return;
        const stData = await stRes.json();
        if (stData.status === "ended") {
          clearInterval(pollAnswer);
          cleanupCall();
        } else if (stData.answer && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(stData.answer));
          setCallStatusText("Connected");
        }
      }, 2000);
    } catch {
      cleanupCall();
      alert("Camera/Microphone access failed.");
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.call_type === "video",
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`${API_URL}/calls/${incomingCall._id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ answer: { type: answer.type, sdp: answer.sdp } }),
      });

      setActiveCall({
        id: incomingCall._id,
        peer: incomingCall.caller,
        call_type: incomingCall.call_type,
      });
      setIncomingCall(null);
      setCallStatusText("Connected");
      setTimeout(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }, 200);
    } catch {
      cleanupCall();
    }
  };

  const endActiveCall = async () => {
    const callId = activeCall?.id || incomingCall?._id;
    if (callId) {
      await fetch(`${API_URL}/calls/${callId}/end`, {
        method: "POST",
        headers: authHeaders,
      }).catch(() => {});
    }
    cleanupCall();
  };

  // Render AuthPage if not logged in
  if (!token) {
    return (
      <AuthPage
        onLoginSuccess={(newToken, newUsername) => {
          setToken(newToken);
          setCurrentUser(newUsername);
        }}
      />
    );
  }

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;
  const isOwnProfile =
    viewedUsername?.trim().toLowerCase() === currentUser?.trim().toLowerCase();

  return (
    <div className="ig-shell">
      {/* DESKTOP SIDEBAR */}
      <aside className="ig-sidebar">
        <div
          className="ig-logo-text"
          style={{ fontSize: "28px", padding: "12px", marginBottom: "18px", cursor: "pointer" }}
          onClick={() => setActiveTab("home")}
        >
          Pixagram
        </div>

        <button className={`ig-nav-item ${activeTab === "home" ? "active" : ""}`} onClick={() => setActiveTab("home")}>
          <Icons.Home active={activeTab === "home"} /> <span>Home</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "search" ? "active" : ""}`} onClick={() => { setActiveTab("search"); handleSearch(""); }}>
          <Icons.Search /> <span>Search</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "explore" ? "active" : ""}`} onClick={() => setActiveTab("explore")}>
          <Icons.Explore active={activeTab === "explore"} /> <span>Explore</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "reels" ? "active" : ""}`} onClick={() => { setActiveTab("reels"); fetchReels(); }}>
          <Icons.Reels active={activeTab === "reels"} /> <span>Reels</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "messages" ? "active" : ""}`} onClick={() => setActiveTab("messages")}>
          <Icons.Messages active={activeTab === "messages"} /> <span>Messages</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "notifications" ? "active" : ""}`} onClick={() => { setActiveTab("notifications"); fetchNotifications(); }}>
          <Icons.Heart filled={activeTab === "notifications"} />
          <span>Notifications {unreadNotifsCount > 0 && `(${unreadNotifsCount})`}</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "create" ? "active" : ""}`} onClick={() => { setCreateMode("post"); setActiveTab("create"); }}>
          <Icons.Create /> <span>Create</span>
        </button>

        <button className={`ig-nav-item ${activeTab === "profile" && isOwnProfile ? "active" : ""}`} onClick={() => openProfile(currentUser)}>
          <div className="ig-avatar-32" style={{ width: "24px", height: "24px", fontSize: "12px" }}>
            {currentUser[0]}
          </div>
          <span>Profile</span>
        </button>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          <button className="ig-nav-item" onClick={() => setDarkMode(!darkMode)}>
            <span>{darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}</span>
          </button>
          <button className="ig-nav-item" onClick={() => setActiveTab("settings")}>
            <span>⚙️ Settings</span>
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="ig-mobile-top">
        <span className="ig-logo-text" style={{ fontSize: "24px" }} onClick={() => setActiveTab("home")}>
          Pixagram
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button className="ig-svg-btn" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="ig-svg-btn" onClick={() => { setActiveTab("notifications"); fetchNotifications(); }}>
            <Icons.Heart filled={unreadNotifsCount > 0} />
          </button>
          <button className="ig-svg-btn" onClick={() => setActiveTab("messages")}>
            <Icons.Messages active={activeTab === "messages"} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="ig-main">
        {/* 1. HOME FEED */}
        {activeTab === "home" && (
          <div className="ig-feed-wrap">
            <div className="ig-feed-col">
              <StoriesBar
                stories={stories}
                currentUser={currentUser}
                authHeaders={authHeaders}
                onRefreshStories={fetchStories}
                onOpenProfile={openProfile}
                onOpenCreateStory={() => {
                  setCreateMode("story");
                  setActiveTab("create");
                }}
              />

              {feedPosts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  <h3>Welcome to Pixagram</h3>
                  <p style={{ fontSize: "14px" }}>Follow friends or create your first post!</p>
                </div>
              ) : (
                feedPosts.map((post) => (
                  <FeedPostCard
                    key={post._id}
                    post={post}
                    currentUser={currentUser}
                    meObj={meObj}
                    allUsers={allUsers}
                    authHeaders={authHeaders}
                    onOpenProfile={openProfile}
                    onRefreshFeed={fetchFeed}
                    onRefreshMe={fetchMe}
                  />
                ))
              )}
            </div>

            {/* RIGHT SUGGESTIONS PANEL */}
            <div className="ig-right-col">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => openProfile(currentUser)}>
                  <div className="ig-avatar-44">{currentUser[0]}</div>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px" }}>{currentUser}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{meObj?.full_name}</div>
                  </div>
                </div>
                <button className="ig-link-btn" onClick={handleLogout}>Logout</button>
              </div>

              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "12px" }}>
                Suggested for you
              </div>
              {allUsers
                .filter((u) => u.username !== currentUser && !meObj?.following?.includes(u.username))
                .slice(0, 6)
                .map((u) => (
                  <div key={u._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => openProfile(u.username)}>
                      <div className="ig-avatar-32">{u.username[0]}</div>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>{u.username}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.full_name}</div>
                      </div>
                    </div>
                    <button className="ig-link-btn" onClick={() => handleFollow(u.username)}>
                      {u.follow_requests?.includes(currentUser) ? "Requested" : "Follow"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 2. SEARCH */}
        {activeTab === "search" && (
          <div style={{ maxWidth: "600px", margin: "24px auto", padding: "0 16px" }}>
            <input
              className="ig-input"
              placeholder="Search users (exact username for private accounts) or #hashtags..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ marginBottom: "18px" }}
            />
            {searchResults.users.map((u) => (
              <div
                key={u._id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", cursor: "pointer" }}
                onClick={() => openProfile(u.username)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="ig-avatar-44">{u.username[0]}</div>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>
                      {u.username} {u.is_private && "🔒"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{u.full_name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. EXPLORE GRID */}
        {activeTab === "explore" && (
          <div style={{ maxWidth: "900px", margin: "20px auto", padding: "0 12px" }}>
            <div className="ig-grid-3">
              {feedPosts.map((p) => (
                <div key={p._id} className="ig-grid-item" onClick={() => openProfile(p.username)}>
                  {p.media_type === "video" ? (
                    <video src={p.media_url} muted />
                  ) : (
                    <img src={p.media_url} alt="Explore" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. REELS */}
        {activeTab === "reels" && (
          <div style={{ maxWidth: "420px", margin: "16px auto", padding: "0 12px" }}>
            {reels.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "40px" }}>
                No reels uploaded yet. Upload a video post as a Reel!
              </p>
            ) : (
              reels.map((r) => (
                <FeedPostCard
                  key={r._id}
                  post={r}
                  currentUser={currentUser}
                  meObj={meObj}
                  allUsers={allUsers}
                  authHeaders={authHeaders}
                  onOpenProfile={openProfile}
                  onRefreshFeed={fetchReels}
                  onRefreshMe={fetchMe}
                />
              ))
            )}
          </div>
        )}

        {/* 5. MESSAGES / DM + NOTES + TYPING + VOICE NOTES */}
        {activeTab === "messages" && (
          <MessagesTab
            currentUser={currentUser}
            meObj={meObj}
            allUsers={allUsers}
            selectedChatUser={selectedChatUser}
            setSelectedChatUser={setSelectedChatUser}
            messages={messages}
            fetchMessages={fetchMessages}
            authHeaders={authHeaders}
            onOpenProfile={openProfile}
            onStartCall={startCall}
            onRefreshUsers={fetchAllUsers}
          />
        )}

        {/* 6. NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div style={{ maxWidth: "560px", margin: "24px auto", padding: "0 16px" }}>
            <h3 style={{ marginBottom: "16px" }}>Notifications</h3>
            {meObj?.follow_requests?.length > 0 && (
              <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid var(--border-line)", borderRadius: "12px" }}>
                <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "10px" }}>Follow Requests</div>
                {meObj.follow_requests.map((reqUser) => (
                  <div key={reqUser} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "600", cursor: "pointer" }} onClick={() => openProfile(reqUser)}>
                      {reqUser}
                    </span>
                    <button className="ig-btn-blue" onClick={() => handleAcceptRequest(reqUser)}>Confirm</button>
                  </div>
                ))}
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n._id}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid var(--border-line)", cursor: "pointer" }}
                onClick={() => openProfile(n.actor)}
              >
                <div className="ig-avatar-32">{n.actor[0]}</div>
                <div style={{ flex: 1, fontSize: "13px" }}>
                  <strong>{n.actor}</strong> {n.text}{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{formatTimeAgo(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 7. CREATE POST / STORY */}
        {activeTab === "create" && (
          <div style={{ maxWidth: "460px", margin: "28px auto", padding: "20px", background: "var(--bg-card)", border: "1px solid var(--border-line)", borderRadius: "14px" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button className={createMode === "post" ? "ig-btn-blue" : "ig-btn-gray"} onClick={() => setCreateMode("post")}>
                New Post / Reel
              </button>
              <button className={createMode === "story" ? "ig-btn-blue" : "ig-btn-gray"} onClick={() => setCreateMode("story")}>
                24h Story
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                type="file"
                accept="image/*,video/*"
                multiple={createMode === "post"}
                onChange={(e) => setCreateFiles(Array.from(e.target.files || []))}
                required
              />
              <input
                className="ig-input"
                placeholder="Write a caption..."
                value={createCaption}
                onChange={(e) => setCreateCaption(e.target.value)}
              />
              {createMode === "post" ? (
                <>
                  <input
                    className="ig-input"
                    placeholder="Add location (optional)"
                    value={createLocation}
                    onChange={(e) => setCreateLocation(e.target.value)}
                  />
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={isReelUpload} onChange={(e) => setIsReelUpload(e.target.checked)} />
                    Share as Reel
                  </label>
                </>
              ) : (
                <>
                  <input
                    className="ig-input"
                    placeholder="Music title (optional)"
                    value={storyMusic}
                    onChange={(e) => setStoryMusic(e.target.value)}
                  />
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={storyCloseFriends} onChange={(e) => setStoryCloseFriends(e.target.checked)} />
                    Close Friends Only 💚
                  </label>
                </>
              )}
              <button type="submit" disabled={isUploading} className="ig-btn-blue">
                {isUploading ? "Uploading..." : "Share"}
              </button>
            </form>
          </div>
        )}

        {/* 8. PROFILE PAGE */}
        {activeTab === "profile" && profileData && (
          <ProfileTab
            profileData={profileData}
            currentUser={currentUser}
            viewedUsername={viewedUsername}
            authHeaders={authHeaders}
            onOpenProfile={openProfile}
            onFollow={handleFollow}
            onBlockUser={handleBlockUser}
            onStartCall={startCall}
            onOpenChat={(targetUser) => {
              setActiveTab("messages");
              setSelectedChatUser(targetUser);
              fetchMessages(targetUser.username);
            }}
            onOpenSettings={() => setActiveTab("settings")}
            onLogout={handleLogout}
            onRefreshMe={fetchMe}
          />
        )}

        {/* 9. SETTINGS & PRIVACY */}
        {activeTab === "settings" && (
          <SettingsTab
            meObj={meObj}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            authHeaders={authHeaders}
            onRefreshMe={fetchMe}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="ig-mobile-bottom">
        <button className="ig-svg-btn" onClick={() => setActiveTab("home")}>
          <Icons.Home active={activeTab === "home"} />
        </button>
        <button className="ig-svg-btn" onClick={() => { setActiveTab("search"); handleSearch(""); }}>
          <Icons.Search />
        </button>
        <button className="ig-svg-btn" onClick={() => { setCreateMode("post"); setActiveTab("create"); }}>
          <Icons.Create />
        </button>
        <button className="ig-svg-btn" onClick={() => { setActiveTab("reels"); fetchReels(); }}>
          <Icons.Reels active={activeTab === "reels"} />
        </button>
        <button className="ig-svg-btn" onClick={() => openProfile(currentUser)}>
          <div className="ig-avatar-32" style={{ width: "26px", height: "26px", fontSize: "12px" }}>
            {currentUser[0]}
          </div>
        </button>
      </nav>

      {/* INCOMING CALL BANNER */}
      {incomingCall && !activeCall && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-line)",
            padding: "14px 20px",
            borderRadius: "16px",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div>
            <strong>{incomingCall.caller}</strong> is {incomingCall.call_type} calling...
          </div>
          <button className="ig-btn-blue" style={{ background: "#1ed760", color: "#000" }} onClick={acceptIncomingCall}>
            Accept
          </button>
          <button className="ig-btn-blue" style={{ background: "#ff3040" }} onClick={endActiveCall}>
            Decline
          </button>
        </div>
      )}

      {/* ACTIVE CALL MODAL */}
      {activeCall && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#000",
            zIndex: 1300,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px",
            color: "#fff",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h3>{activeCall.peer}</h3>
            <p style={{ fontSize: "13px", color: "#1ed760" }}>{callStatusText}</p>
          </div>
          <div style={{ position: "relative", width: "100%", maxWidth: "480px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", maxHeight: "70vh", borderRadius: "14px", background: "#111" }} />
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                width: "110px",
                borderRadius: "10px",
                border: "2px solid #fff",
              }}
            />
          </div>
          <button className="ig-btn-blue" style={{ background: "#ff3040", padding: "12px 28px", borderRadius: "30px" }} onClick={endActiveCall}>
            End Call
          </button>
        </div>
      )}
    </div>
  );
}