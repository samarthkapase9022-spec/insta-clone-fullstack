import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = "https://insta-clone-fullstack-0t7a.onrender.com";

// Relative Time Helper ("Just now", "5m ago", "2h ago")
function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Chat Bubble Clock Helper ("07:25 PM")
function formatChatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString.endsWith("Z") ? isoString : isoString + "Z");
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Check if user was active within last 65 seconds
function getOnlineStatus(lastSeenIso) {
  if (!lastSeenIso) return { isOnline: false, label: "Offline" };
  const date = new Date(lastSeenIso.endsWith("Z") ? lastSeenIso : lastSeenIso + "Z");
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec <= 65) return { isOnline: true, label: "Active now" };
  return { isOnline: false, label: `Active ${formatTimeAgo(lastSeenIso)}` };
}

const Icons = {
  Home: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z" strokeLinejoin="round" />
    </svg>
  ),
  Search: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="10.5" cy="10.5" r="8.5" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" strokeLinecap="round" />
    </svg>
  ),
  Explore: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <polygon points="13.941 13.953 7.581 16.424 10.06 10.056 16.42 7.585 13.941 13.953" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Reels: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
    </svg>
  ),
  Messenger: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="3" x2="9.218" y2="10.083" />
      <polygon points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" />
    </svg>
  ),
  Bell: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938Z" />
    </svg>
  ),
  Create: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
    </svg>
  ),
  Settings: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Heart: ({ liked }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={liked ? "#ff3040" : "none"} stroke={liked ? "#ff3040" : "currentColor"} strokeWidth="2">
      <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938Z" />
    </svg>
  ),
  Comment: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" strokeLinejoin="round" />
    </svg>
  ),
  Bookmark: ({ saved }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <polygon points="20 21 12 13.44 4 21 4 3 20 3 20 21" />
    </svg>
  ),
  Phone: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  VideoCall: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Verified: () => (
    <svg width="14" height="14" viewBox="0 0 40 40" fill="#0095f6">
      <path d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h5.975L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.162v-6.01L40 25.359 36.905 20 40 14.641l-5.248-3.03v-6.46h-6.419L25.358 0l-5.36 3.094Zm7.415 11.225 2.254 2.287-11.43 11.5-6.835-6.93 2.244-2.258 4.587 4.581 9.18-9.18Z" />
    </svg>
  ),
};

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(localStorage.getItem("username") || "");
  const [darkMode, setDarkMode] = useState(false);

  const [activeTab, setActiveTab] = useState("home");
  const [viewedUsername, setViewedUsername] = useState("");

  const [isSignup, setIsSignup] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "", full_name: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  const [posts, setPosts] = useState([]);
  const [carouselIdx, setCarouselIdx] = useState({});
  const [openMenuPostId, setOpenMenuPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [heartBurstId, setHeartBurstId] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [selectedPostModal, setSelectedPostModal] = useState(null);
  const lastTapRef = useRef(0);

  const [reels, setReels] = useState([]);

  const [stories, setStories] = useState([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [storyForm, setStoryForm] = useState({ caption: "", music_name: "", poll_question: "", poll_opt1: "Yes", poll_opt2: "No", close_friends_only: false, file: null });
  const [storyReplyText, setStoryReplyText] = useState("");
  const [highlightTitle, setHighlightTitle] = useState("");

  const [postFiles, setPostFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [isReelUpload, setIsReelUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
  const [profileData, setProfileData] = useState(null);
  const [profileSubTab, setProfileSubTab] = useState("posts");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", bio: "", is_private: false });
  const [listModal, setListModal] = useState(null);

  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyToMsg, setReplyToMsg] = useState("");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [hasUnreadDM, setHasUnreadDM] = useState(false);

  // Live WebRTC Call State
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOff, setIsCamOff] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [passForm, setPassForm] = useState({ old_password: "", new_password: "" });
  const [deletePass, setDeletePass] = useState("");

  const authHeaders = { Authorization: `Bearer ${token}` };
  const activeStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  useEffect(() => {
    if (token) {
      fetchFeed(true);
      fetchStories();
      fetchAllUsers();
      fetchNotifications(true);
      pingServer();
    }
  }, [token]);

  // Attach local & remote media streams safely once call modal renders
  useEffect(() => {
    if (activeCall) {
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [activeCall, activeCall?.status]);

  // Heartbeat Ping every 15s + Safe Call Polling every 4s
  useEffect(() => {
    if (!token) return;
    const pingTimer = setInterval(() => {
      pingServer();
      fetchAllUsers();
    }, 15000);

    const callPollTimer = setInterval(async () => {
      try {
        if (!activeCall && !incomingCall) {
          const res = await fetch(`${API_URL}/calls/incoming`, { headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            if (data && data._id) setIncomingCall(data);
          }
        }
        if (activeCall && activeCall.status === "ringing") {
          const res = await fetch(`${API_URL}/calls/${activeCall.call_id}`, { headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "connected" && data.answer && pcRef.current) {
              if (pcRef.current.signalingState === "have-local-offer") {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              }
              setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
            } else if (data.status === "ended") {
              cleanupWebRTC();
            }
          }
        }
        if (activeCall && activeCall.status === "connected") {
          const res = await fetch(`${API_URL}/calls/${activeCall.call_id}`, { headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "ended") cleanupWebRTC();
          }
        }
      } catch (err) {
        console.error("Call poll error:", err);
      }
    }, 4000);

    return () => {
      clearInterval(pingTimer);
      clearInterval(callPollTimer);
    };
  }, [token, activeCall, incomingCall]);

  // Auto-advance 5s Story Progress Timer
  useEffect(() => {
    if (activeStoryIndex === null || !activeStory) return;
    setStoryProgress(0);
    const interval = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          if (activeStoryIndex < stories.length - 1) {
            const nextIdx = activeStoryIndex + 1;
            setActiveStoryIndex(nextIdx);
            fetch(`${API_URL}/stories/${stories[nextIdx]._id}/view`, { method: "POST", headers: authHeaders });
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [activeStoryIndex, stories.length]);

  useEffect(() => {
    if (!token) return;
    const bgTimer = setInterval(() => {
      fetchNotifications(true);
      if (activeTab === "messages" && selectedChatUser) {
        fetchMessages(selectedChatUser.username);
      }
    }, 5000);
    return () => clearInterval(bgTimer);
  }, [token, activeTab, selectedChatUser]);

  const pingServer = async () => {
    try {
      await fetch(`${API_URL}/users/ping`, { method: "POST", headers: authHeaders });
    } catch (e) {}
  };

  // --- CRASH-PROOF TWO-WAY WEBRTC CALLING ---
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });
    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      remoteStreamRef.current = stream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };
    return pc;
  };

  const waitForIceGathering = (pc) =>
    new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const checkState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", checkState);
      setTimeout(resolve, 2500);
    });

  const startCall = async (targetUser, callType) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera/Mic not supported in this browser. Please open in Chrome or Safari.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setIsMuted(false);
      setIsSpeakerOn(true);
      setIsCamOff(false);

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const safeOffer = {
        type: pc.localDescription?.type || offer.type,
        sdp: pc.localDescription?.sdp || offer.sdp,
      };

      const res = await fetch(`${API_URL}/calls/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          callee: targetUser.username,
          call_type: callType,
          offer: safeOffer,
        }),
      });

      if (res.ok) {
        const { call_id } = await res.json();
        setActiveCall({ call_id, peerUser: targetUser.username, call_type: callType, status: "ringing" });

        // Record call history inside DM chat
        await fetch(`${API_URL}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            receiver: targetUser.username,
            text: callType === "video" ? "📹 Started a video call" : "📞 Started an audio call",
          }),
        });
        if (selectedChatUser?.username === targetUser.username) {
          fetchMessages(targetUser.username);
        }
      } else {
        cleanupWebRTC();
        alert("Could not connect call.");
      }
    } catch (err) {
      cleanupWebRTC();
      alert("Call failed: " + (err?.message || "Check camera/mic permissions"));
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Browser does not support camera/microphone access.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.call_type === "video" ? { facingMode: "user" } : false,
      });
      localStreamRef.current = stream;
      setIsMuted(false);
      setIsSpeakerOn(true);
      setIsCamOff(false);

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);

      const safeAnswer = {
        type: pc.localDescription?.type || answer.type,
        sdp: pc.localDescription?.sdp || answer.sdp,
      };

      await fetch(`${API_URL}/calls/${incomingCall._id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ answer: safeAnswer }),
      });

      setActiveCall({
        call_id: incomingCall._id,
        peerUser: incomingCall.caller,
        call_type: incomingCall.call_type,
        status: "connected",
      });
      setIncomingCall(null);
    } catch (err) {
      cleanupWebRTC();
      alert("Could not accept call: " + (err?.message || "Permission denied"));
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = async () => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = nextState ? 1.0 : 0.25;
      if (typeof remoteVideoRef.current.setSinkId === "function") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOuts = devices.filter((d) => d.kind === "audiooutput");
          if (audioOuts.length > 1) {
            await remoteVideoRef.current.setSinkId(nextState ? audioOuts[audioOuts.length - 1].deviceId : audioOuts[0].deviceId);
          }
        } catch (e) {}
      }
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = isCamOff;
    });
    setIsCamOff(!isCamOff);
  };

  const endOrDeclineCall = async (callId) => {
    if (callId) {
      await fetch(`${API_URL}/calls/${callId}/end`, { method: "POST", headers: authHeaders }).catch(() => {});
    }
    setIncomingCall(null);
    cleanupWebRTC();
  };

  const cleanupWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setActiveCall(null);
  };

  // --- EXISTING API CALLS ---
  const fetchFeed = async (isInitial = false) => {
    if (isInitial) setFeedLoading(true);
    const wakeTimer = setTimeout(() => {
      if (isInitial) setServerWaking(true);
    }, 3500);

    try {
      const res = await fetch(`${API_URL}/posts`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
        if (selectedPostModal) {
          const updated = data.find((p) => p._id === selectedPostModal._id);
          if (updated) setSelectedPostModal(updated);
        }
      }
    } finally {
      clearTimeout(wakeTimer);
      setFeedLoading(false);
      setServerWaking(false);
    }
  };

  const fetchReels = async () => {
    const res = await fetch(`${API_URL}/reels`, { headers: authHeaders });
    if (res.ok) setReels(await res.json());
  };

  const fetchStories = async () => {
    const res = await fetch(`${API_URL}/stories`, { headers: authHeaders });
    if (res.ok) setStories(await res.json());
  };

  const fetchAllUsers = async () => {
    const res = await fetch(`${API_URL}/users/search?q=`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.users || []);
    }
  };

  const fetchNotifications = async (silent = false) => {
    const res = await fetch(`${API_URL}/notifications`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
      const seenCount = Number(localStorage.getItem("seenNotifs") || 0);
      if (!silent) {
        localStorage.setItem("seenNotifs", String(data.length));
        setUnreadNotifCount(0);
      } else if (data.length > seenCount) {
        setUnreadNotifCount(data.length - seenCount);
        const latest = data[0];
        if (latest && latest.text?.includes("message")) {
          setHasUnreadDM(true);
        }
      }
    }
  };

  const openProfile = async (targetUsername) => {
    setViewedUsername(targetUsername);
    setActiveTab("profile");
    setProfileSubTab("posts");
    setIsEditingProfile(false);
    setSelectedPostModal(null);
    const res = await fetch(`${API_URL}/users/${targetUsername}`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setProfileData(data);
      setEditForm({
        full_name: data.user.full_name || "",
        bio: data.user.bio || "",
        is_private: data.user.is_private || false,
      });
    } else {
      const err = await res.json();
      alert(err.detail || "Cannot open profile");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const wakeTimer = setTimeout(() => setServerWaking(true), 3000);
    try {
      if (isSignup) {
        const res = await fetch(`${API_URL}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Signup failed");
        alert("Account created! Please log in.");
        setIsSignup(false);
      } else {
        const loginData = new URLSearchParams();
        loginData.append("username", authForm.email);
        loginData.append("password", authForm.password);
        const res = await fetch(`${API_URL}/login`, { method: "POST", body: loginData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed");
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        setToken(data.access_token);
        setCurrentUser(data.username);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      clearTimeout(wakeTimer);
      setAuthLoading(false);
      setServerWaking(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken("");
    setCurrentUser("");
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (postFiles.length === 0) return alert("Select at least one image or video!");
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("location", location);
    formData.append("is_reel", isReelUpload);
    for (let i = 0; i < postFiles.length; i++) {
      formData.append("files", postFiles[i]);
    }

    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (res.ok) {
        setCaption("");
        setLocation("");
        setPostFiles([]);
        setIsReelUpload(false);
        setActiveTab("home");
        fetchFeed();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (postId) => {
    await fetch(`${API_URL}/posts/${postId}/like`, { method: "POST", headers: authHeaders });
    fetchFeed();
    if (activeTab === "reels") fetchReels();
  };

  const handleDoubleTap = (post) => {
    setHeartBurstId(post._id);
    setTimeout(() => setHeartBurstId(null), 850);
    if (!post.likes?.includes(currentUser)) handleLike(post._id);
  };

  const handleTouchTap = (post) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap(post);
    }
    lastTapRef.current = now;
  };

  const handleComment = async (e, postId) => {
    e.preventDefault();
    const text = commentText[postId];
    if (!text?.trim()) return;
    await fetch(`${API_URL}/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ text }),
    });
    setCommentText({ ...commentText, [postId]: "" });
    fetchFeed();
  };

  const handleSavePost = async (postId) => {
    await fetch(`${API_URL}/posts/${postId}/save`, { method: "POST", headers: authHeaders });
    fetchAllUsers();
  };

  const handleDeletePost = async (postId) => {
    await fetch(`${API_URL}/posts/${postId}`, { method: "DELETE", headers: authHeaders });
    setOpenMenuPostId(null);
    fetchFeed();
  };

  const handleEditPostSave = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/posts/${editingPost._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ caption: editingPost.caption, location: editingPost.location }),
    });
    setEditingPost(null);
    fetchFeed();
  };

  const handleNotInterested = async (postId) => {
    await fetch(`${API_URL}/posts/${postId}/not-interested`, { method: "POST", headers: authHeaders });
    setOpenMenuPostId(null);
    fetchFeed();
  };

  const handleReport = async (targetType, targetId) => {
    const reason = prompt("Enter reason for reporting:");
    if (!reason) return;
    await fetch(`${API_URL}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    });
    setOpenMenuPostId(null);
    alert("Report submitted to moderation team.");
  };

  const handleCreateStory = async (e) => {
    e.preventDefault();
    if (!storyForm.file) return;
    const fd = new FormData();
    fd.append("file", storyForm.file);
    fd.append("caption", storyForm.caption);
    fd.append("music_name", storyForm.music_name);
    fd.append("poll_question", storyForm.poll_question);
    fd.append("poll_opt1", storyForm.poll_opt1);
    fd.append("poll_opt2", storyForm.poll_opt2);
    fd.append("close_friends_only", storyForm.close_friends_only);

    const res = await fetch(`${API_URL}/stories`, { method: "POST", headers: authHeaders, body: fd });
    if (res.ok) {
      setShowStoryCreator(false);
      fetchStories();
    }
  };

  const openStoryViewer = async (index) => {
    setActiveStoryIndex(index);
    const target = stories[index];
    if (target) {
      await fetch(`${API_URL}/stories/${target._id}/view`, { method: "POST", headers: authHeaders });
    }
  };

  const handleStoryTapNavigation = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      if (activeStoryIndex > 0) openStoryViewer(activeStoryIndex - 1);
    } else {
      if (activeStoryIndex < stories.length - 1) openStoryViewer(activeStoryIndex + 1);
      else setActiveStoryIndex(null);
    }
  };

  const handleVotePoll = async (storyId, optionIndex) => {
    const res = await fetch(`${API_URL}/stories/${storyId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ option_index: optionIndex }),
    });
    if (res.ok) {
      const data = await res.json();
      const updatedStories = [...stories];
      updatedStories[activeStoryIndex] = { ...activeStory, poll: data.poll };
      setStories(updatedStories);
    }
  };

  const handleStoryReply = async (e) => {
    e.preventDefault();
    if (!storyReplyText.trim()) return;
    await fetch(`${API_URL}/stories/${activeStory._id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ text: storyReplyText }),
    });
    setStoryReplyText("");
    alert("Reply sent to DM!");
  };

  const handleSaveHighlight = async () => {
    if (!highlightTitle.trim()) return alert("Enter highlight name!");
    await fetch(`${API_URL}/users/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ title: highlightTitle, story_id: activeStory._id }),
    });
    setHighlightTitle("");
    alert("Added to your Profile Highlights!");
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders });
    if (res.ok) setSearchResults(await res.json());
  };

  const handleFollow = async (targetUsername) => {
    await fetch(`${API_URL}/users/${targetUsername}/follow`, { method: "POST", headers: authHeaders });
    fetchAllUsers();
    if (activeTab === "profile") openProfile(targetUsername);
  };

  const handleAcceptRequest = async (requester) => {
    await fetch(`${API_URL}/users/follow-requests/${requester}/accept`, { method: "POST", headers: authHeaders });
    fetchAllUsers();
    fetchNotifications();
  };

  const handleBlockUser = async (targetUsername) => {
    await fetch(`${API_URL}/users/${targetUsername}/block`, { method: "POST", headers: authHeaders });
    alert(`Updated block status for @${targetUsername}`);
    fetchAllUsers();
    setActiveTab("home");
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/users/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(editForm),
    });
    setIsEditingProfile(false);
    openProfile(currentUser);
  };

  const handleAvatarChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    await fetch(`${API_URL}/users/profile-pic`, { method: "POST", headers: authHeaders, body: fd });
    openProfile(currentUser);
    fetchAllUsers();
  };

  const fetchMessages = async (otherUser) => {
    const res = await fetch(`${API_URL}/messages/${otherUser}`, { headers: authHeaders });
    if (res.ok) setMessages(await res.json());
  };

  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChatUser) return;
      const res = await fetch(${API_URL}/messages, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
      receiver: selectedChatUser.username,
      text: newMessage,
      reply_to_text: replyToMsg,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert(err.detail || "Cannot send message to this private account.");
      }
      setNewMessage("");
      setReplyToMsg("");
      fetchMessages(selectedChatUser.username);
      fetchAllUsers();
  };

  const handleSendChatImage = async (e) => {
    const f = e.target.files[0];
    if (!f || !selectedChatUser) return;
    const fd = new FormData();
    fd.append("file", f);
    const upRes = await fetch(`${API_URL}/messages/upload-media`, { method: "POST", headers: authHeaders, body: fd });
    if (upRes.ok) {
      const { media_url } = await upRes.json();
      await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ receiver: selectedChatUser.username, media_url }),
      });
      fetchMessages(selectedChatUser.username);
    }
  };

  const handleReactMsg = async (msgId, emoji) => {
    await fetch(`${API_URL}/messages/${msgId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ emoji }),
    });
    fetchMessages(selectedChatUser.username);
  };

  const handleUnsendMsg = async (msgId) => {
    await fetch(`${API_URL}/messages/${msgId}`, { method: "DELETE", headers: authHeaders });
    fetchMessages(selectedChatUser.username);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(passForm),
    });
    const data = await res.json();
    alert(data.message || data.detail);
    setPassForm({ old_password: "", new_password: "" });
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePass.trim()) return;
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete your account, posts, stories, and messages. This action cannot be undone!"
    );
    if (!confirmed) return;

    const res = await fetch(`${API_URL}/users/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ password: deletePass }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      handleLogout();
    } else {
      alert(data.detail || "Failed to delete account.");
    }
  };

  const renderFormattedCaption = (text) => {
    return text.split(" ").map((word, i) => {
      if (word.startsWith("#")) {
        return (
          <span key={i} style={{ color: "#0095f6", cursor: "pointer" }} onClick={() => { setActiveTab("search"); handleSearch(word); }}>
            {word}{" "}
          </span>
        );
      }
      if (word.startsWith("@")) {
        return (
          <span key={i} style={{ color: "#0095f6", cursor: "pointer" }} onClick={() => openProfile(word.slice(1))}>
            {word}{" "}
          </span>
        );
      }
      return word + " ";
    });
  };

  if (!token) {
    return (
      <div className="ig-auth-box">
        <div className="ig-wordmark" style={{ fontSize: "44px", display: "block" }}>Pixagram</div>
        {serverWaking && (
          <div className="ig-wake-banner">
            ⏳ Waking up free cloud server (takes ~30s on first open)...
          </div>
        )}
        <form onSubmit={handleAuth}>
          {isSignup && (
            <>
              <input className="ig-input" type="text" placeholder="Username" required onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} />
              <input className="ig-input" type="text" placeholder="Full Name" onChange={(e) => setAuthForm({ ...authForm, full_name: e.target.value })} />
            </>
          )}
          <input className="ig-input" type="email" placeholder="Email" required onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
          <input className="ig-input" type="password" placeholder="Password" required onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
          <button type="submit" className="ig-btn-blue" style={{ width: "100%", marginTop: "12px", padding: "10px" }} disabled={authLoading}>
            {authLoading ? "Connecting..." : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>
        {!isSignup && (
          <p
            style={{ marginTop: "14px", fontSize: "12px", color: "#0095f6", cursor: "pointer", fontWeight: "600" }}
            onClick={async () => {
              const email = prompt("Tumcha registered Email taka:");
              const username = prompt("Tumcha Username taka:");
              const new_password = prompt("Navin Password taka:");
              if (!email || !username || !new_password) return;
              const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, username, new_password }),
              });
              const data = await res.json();
              alert(data.message || data.detail);
            }}
          >
            Forgot password?
          </p>
        )}
        <p style={{ marginTop: "20px", fontSize: "14px" }}>
          {isSignup ? "Have an account?" : "Don't have an account?"}{" "}
          <span style={{ color: "#0095f6", fontWeight: "600", cursor: "pointer" }} onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    );
  }

  const meObj = allUsers.find((u) => u.username === currentUser);
  const suggestedUsers = allUsers.filter((u) => u.username !== currentUser).slice(0, 5);
  const activeChatLiveUser = selectedChatUser ? allUsers.find((u) => u.username === selectedChatUser.username) || selectedChatUser : null;

  return (
    <div className={`ig-shell ${darkMode ? "dark-mode" : ""}`}>
      {/* MOBILE TOP HEADER */}
      <header className="ig-mobile-header">
        <div className="ig-mobile-logo" onClick={() => { setActiveTab("home"); fetchFeed(); }}>Pixagram</div>
        <div className="ig-mobile-top-actions">
          <button className="ig-svg-btn" onClick={() => setDarkMode(!darkMode)} title="Theme">
            <span style={{ fontSize: "18px" }}>{darkMode ? "☀️" : "🌙"}</span>
          </button>
          <button className="ig-svg-btn icon-badge-wrap" onClick={() => { setActiveTab("notifications"); fetchNotifications(false); fetchAllUsers(); }}>
            <Icons.Bell active={activeTab === "notifications"} />
            {unreadNotifCount > 0 && <span className="ig-red-dot" />}
          </button>
          <button className="ig-svg-btn icon-badge-wrap" onClick={() => { setActiveTab("messages"); setHasUnreadDM(false); fetchAllUsers(); }}>
            <Icons.Messenger active={activeTab === "messages"} />
            {hasUnreadDM && <span className="ig-red-dot" />}
          </button>
        </div>
      </header>

      {/* DESKTOP LEFT SIDEBAR */}
      <aside className="ig-sidebar">
        <div>
          <div className="ig-wordmark" onClick={() => setActiveTab("home")}>Pixagram</div>
          <nav className="ig-nav-list">
            <button className={`ig-nav-btn ${activeTab === "home" ? "active" : ""}`} onClick={() => { setActiveTab("home"); fetchFeed(); }}>
              <Icons.Home active={activeTab === "home"} /> <span className="ig-nav-text">Home</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "search" ? "active" : ""}`} onClick={() => { setActiveTab("search"); handleSearch(""); }}>
              <Icons.Search /> <span className="ig-nav-text">Search</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "explore" ? "active" : ""}`} onClick={() => { setActiveTab("explore"); fetchFeed(); }}>
              <Icons.Explore active={activeTab === "explore"} /> <span className="ig-nav-text">Explore</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "reels" ? "active" : ""}`} onClick={() => { setActiveTab("reels"); fetchReels(); }}>
              <Icons.Reels active={activeTab === "reels"} /> <span className="ig-nav-text">Reels</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "messages" ? "active" : ""}`} onClick={() => { setActiveTab("messages"); setHasUnreadDM(false); fetchAllUsers(); }}>
              <span className="icon-badge-wrap">
                <Icons.Messenger active={activeTab === "messages"} />
                {hasUnreadDM && <span className="ig-red-dot" />}
              </span>
              <span className="ig-nav-text">Messages</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "notifications" ? "active" : ""}`} onClick={() => { setActiveTab("notifications"); fetchNotifications(false); fetchAllUsers(); }}>
              <span className="icon-badge-wrap">
                <Icons.Bell active={activeTab === "notifications"} />
                {unreadNotifCount > 0 && <span className="ig-red-dot" />}
              </span>
              <span className="ig-nav-text">Notifications</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>
              <Icons.Create /> <span className="ig-nav-text">Create</span>
            </button>
            <button className={`ig-nav-btn ${activeTab === "profile" && viewedUsername === currentUser ? "active" : ""}`} onClick={() => openProfile(currentUser)}>
              <div className="ig-avatar-32" style={{ width: "24px", height: "24px", fontSize: "11px" }}>{currentUser[0]}</div>
              <span className="ig-nav-text">Profile</span>
            </button>
          </nav>
        </div>

        <div className="ig-nav-list">
          <button className={`ig-nav-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => { setActiveTab("settings"); fetchAllUsers(); }}>
            <Icons.Settings /> <span className="ig-nav-text">Settings & Privacy</span>
          </button>
          <button className="ig-nav-btn" onClick={() => setDarkMode(!darkMode)}>
            <span>{darkMode ? "☀️" : "🌙"}</span> <span className="ig-nav-text">{darkMode ? "Light mode" : "Dark mode"}</span>
          </button>
          <button className="ig-nav-btn" onClick={handleLogout} style={{ color: "#ff3040", fontSize: "14px" }}>
            <span className="ig-nav-text">Log out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="ig-mobile-bottom-nav">
        <button className="ig-svg-btn" onClick={() => { setActiveTab("home"); fetchFeed(); }}>
          <Icons.Home active={activeTab === "home"} />
        </button>
        <button className="ig-svg-btn" onClick={() => { setActiveTab("search"); handleSearch(""); }}>
          <Icons.Search />
        </button>
        <button className="ig-svg-btn" onClick={() => setActiveTab("create")}>
          <Icons.Create />
        </button>
        <button className="ig-svg-btn" onClick={() => { setActiveTab("reels"); fetchReels(); }}>
          <Icons.Reels active={activeTab === "reels"} />
        </button>
        <button className="ig-svg-btn" onClick={() => openProfile(currentUser)}>
          <div className="ig-avatar-32" style={{ width: "26px", height: "26px", fontSize: "11px", border: activeTab === "profile" ? "2px solid var(--text-main)" : "none" }}>
            {currentUser[0]}
          </div>
        </button>
      </nav>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="ig-main">
        {/* 1. HOME FEED */}
        {activeTab === "home" && (
          <div className="ig-home-grid">
            <div className="ig-feed-column">
              {serverWaking && (
                <div className="ig-wake-banner" style={{ margin: "8px 12px" }}>
                  ⏳ Waking up server... Your feed will appear in a few seconds.
                </div>
              )}

              {/* Stories Carousel */}
              <div className="ig-stories">
                <div className="ig-story-unit" onClick={() => setShowStoryCreator(true)}>
                  <div className="ig-gradient-ring plain"><div className="ig-story-img">+</div></div>
                  <span className="ig-story-name">Your story</span>
                </div>
                {stories.map((st, index) => (
                  <div key={st._id} className="ig-story-unit" onClick={() => openStoryViewer(index)}>
                    <div className={`ig-gradient-ring ${st.close_friends_only ? "cf" : ""}`}>
                      {st.media_type === "video" ? (
                        <div className="ig-story-img">🎬</div>
                      ) : (
                        <img src={st.media_url} alt={st.username} className="ig-story-img" />
                      )}
                    </div>
                    <span className="ig-story-name">{st.username}</span>
                  </div>
                ))}
              </div>

              {feedLoading && posts.length === 0 ? (
                <div style={{ padding: "12px" }}>
                  {[1, 2].map((n) => (
                    <div key={n} className="ig-skeleton-card">
                      <div className="ig-skeleton-header">
                        <div className="ig-skeleton-circle" />
                        <div className="ig-skeleton-line" style={{ width: "120px" }} />
                      </div>
                      <div className="ig-skeleton-box" />
                    </div>
                  ))}
                </div>
              ) : (
                posts.map((post) => {
                  const mediaList = post.media || [{ url: post.image_url, type: "image" }];
                  const currentSlide = carouselIdx[post._id] || 0;
                  const activeMedia = mediaList[currentSlide] || mediaList[0];
                  const isLiked = post.likes?.includes(currentUser);
                  const isSaved = meObj?.saved_posts?.includes(post._id);
                  const isAuthorFollowed = meObj?.following?.includes(post.username);
                  const authorStatus = getOnlineStatus(post.author_last_seen);

                  return (
                    <article key={post._id} className="ig-post">
                      <div className="ig-post-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => openProfile(post.username)}>
                          <div className="avatar-status-wrap">
                            {post.user_pic ? (
                              <img src={post.user_pic} alt={post.username} className="ig-avatar-32" />
                            ) : (
                              <div className="ig-avatar-32">{post.username[0]}</div>
                            )}
                            {isAuthorFollowed && authorStatus.isOnline && <span className="online-green-dot" />}
                          </div>
                          <div>
                            <div style={{ fontWeight: "600", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
                              {post.username} <Icons.Verified />
                              {post.created_at && (
                                <span style={{ fontWeight: "400", fontSize: "12px", color: "var(--text-muted)" }}>
                                  • {formatTimeAgo(post.created_at)}
                                </span>
                              )}
                            </div>
                            {post.location && <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{post.location}</div>}
                          </div>
                        </div>

                        <button style={{ background: "none", border: "none", color: "var(--text-main)", cursor: "pointer", fontWeight: "bold", padding: "4px 8px" }} onClick={() => setOpenMenuPostId(openMenuPostId === post._id ? null : post._id)}>
                          •••
                        </button>

                        {openMenuPostId === post._id && (
                          <div className="ig-dropdown">
                            {post.username === currentUser ? (
                              <>
                                <button onClick={() => { setEditingPost(post); setOpenMenuPostId(null); }}>Edit Post</button>
                                <button style={{ color: "#ff3040" }} onClick={() => handleDeletePost(post._id)}>Delete Post</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleNotInterested(post._id)}>Not Interested</button>
                                <button style={{ color: "#ff3040" }} onClick={() => handleReport("post", post._id)}>Report Post</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="ig-media-box" onDoubleClick={() => handleDoubleTap(post)} onTouchEnd={() => handleTouchTap(post)}>
                        {activeMedia?.type === "video" ? (
                          <video src={activeMedia.url} controls playsInline />
                        ) : (
                          <img src={activeMedia?.url} alt="Post" />
                        )}

                        {mediaList.length > 1 && (
                          <>
                            {currentSlide > 0 && (
                              <button className="carousel-btn left" onClick={() => setCarouselIdx({ ...carouselIdx, [post._id]: currentSlide - 1 })}>‹</button>
                            )}
                            {currentSlide < mediaList.length - 1 && (
                              <button className="carousel-btn right" onClick={() => setCarouselIdx({ ...carouselIdx, [post._id]: currentSlide + 1 })}>›</button>
                            )}
                            <div style={{ position: "absolute", bottom: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>
                              {currentSlide + 1}/{mediaList.length}
                            </div>
                          </>
                        )}

                        {heartBurstId === post._id && (
                          <div className="ig-heart-burst">
                            <svg width="85" height="85" viewBox="0 0 24 24" fill="#fff">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="ig-post-body">
                        <div className="ig-action-bar">
                          <div className="ig-action-left">
                            <button className="ig-svg-btn" onClick={() => handleLike(post._id)}><Icons.Heart liked={isLiked} /></button>
                            <button className="ig-svg-btn" onClick={() => setSelectedPostModal(post)}><Icons.Comment /></button>
                            <button className="ig-svg-btn" onClick={() => { navigator.clipboard.writeText(activeMedia?.url); alert("Post link copied!"); }}>
                              <Icons.Messenger active={false} />
                            </button>
                          </div>
                          <button className="ig-svg-btn" onClick={() => handleSavePost(post._id)}><Icons.Bookmark saved={isSaved} /></button>
                        </div>

                        <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "6px" }}>{post.likes?.length || 0} likes</div>

                        {post.caption && (
                          <div style={{ fontSize: "14px", marginBottom: "6px" }}>
                            <strong style={{ cursor: "pointer" }} onClick={() => openProfile(post.username)}>{post.username}</strong>{" "}
                            {renderFormattedCaption(post.caption)}
                          </div>
                        )}

                        {post.comments?.slice(-2).map((c, i) => (
                          <div key={i} style={{ fontSize: "13px", marginBottom: "3px" }}>
                            <strong>{c.username}</strong> {c.text}{" "}
                            {c.created_at && <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTimeAgo(c.created_at)}</span>}
                          </div>
                        ))}

                        {post.created_at && (
                          <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-muted)", marginTop: "6px", letterSpacing: "0.4px" }}>
                            {formatTimeAgo(post.created_at)}
                          </div>
                        )}

                        <form style={{ display: "flex", marginTop: "8px" }} onSubmit={(e) => handleComment(e, post._id)}>
                          <input
                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-main)", fontSize: "14px" }}
                            placeholder="Add a comment..."
                            value={commentText[post._id] || ""}
                            onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                          />
                          {commentText[post._id]?.trim() && <button type="submit" className="ig-link-btn">Post</button>}
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Right Suggestions Panel */}
            <div className="ig-right-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => openProfile(currentUser)}>
                  <div className="ig-avatar-44">{currentUser[0]}</div>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>{currentUser}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{meObj?.full_name}</div>
                  </div>
                </div>
                <button className="ig-link-btn" onClick={handleLogout}>Switch</button>
              </div>

              <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-muted)", marginBottom: "14px" }}>Suggested for you</div>
              {suggestedUsers.map((u) => {
                const isFollowing = u.followers?.includes(currentUser);
                const isRequested = u.follow_requests?.includes(currentUser);
                const statusInfo = getOnlineStatus(u.last_seen);
                return (
                  <div key={u._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => openProfile(u.username)}>
                      <div className="avatar-status-wrap">
                        <div className="ig-avatar-32">{u.username[0]}</div>
                        {isFollowing && statusInfo.isOnline && <span className="online-green-dot" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>{u.username}</div>
                        <div style={{ fontSize: "11px", color: statusInfo.isOnline && isFollowing ? "#1ed760" : "var(--text-muted)" }}>
                          {isFollowing ? statusInfo.label : u.is_private ? "Private Account" : "Suggested for you"}
                        </div>
                      </div>
                    </div>
                    <button className="ig-link-btn" onClick={() => handleFollow(u.username)}>
                      {isFollowing ? "Following" : isRequested ? "Requested" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SEARCH */}
        {activeTab === "search" && (
          <div className="ig-feed-column" style={{ padding: "0 12px" }}>
            <h2 style={{ marginBottom: "14px" }}>Search</h2>
            <input className="ig-input" placeholder="Search @users or #hashtags..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
            <h4 style={{ margin: "16px 0 10px", color: "var(--text-muted)" }}>Accounts</h4>
            {searchResults.users?.map((u) => {
              const isFollowing = u.followers?.includes(currentUser);
              const statusInfo = getOnlineStatus(u.last_seen);
              return (
                <div key={u._id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", cursor: "pointer" }} onClick={() => openProfile(u.username)}>
                  <div className="avatar-status-wrap">
                    <div className="ig-avatar-44">{u.username[0]}</div>
                    {isFollowing && statusInfo.isOnline && <span className="online-green-dot" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: "600" }}>{u.username}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {u.full_name} {isFollowing ? `• ${statusInfo.label}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {searchResults.posts?.length > 0 && (
              <>
                <h4 style={{ margin: "16px 0 10px", color: "var(--text-muted)" }}>Matching Posts</h4>
                <div className="ig-grid-3">
                  {searchResults.posts.map((p) => (
                    <div key={p._id} className="ig-grid-tile" onClick={() => setSelectedPostModal(p)}>
                      <img src={(p.media?.[0]?.url) || p.image_url} alt="Search" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. EXPLORE GRID */}
        {activeTab === "explore" && (
          <div className="ig-profile-container">
            <div className="ig-grid-3">
              {posts.map((p) => {
                const firstMedia = p.media?.[0] || { url: p.image_url, type: "image" };
                return (
                  <div key={p._id} className="ig-grid-tile" onClick={() => setSelectedPostModal(p)}>
                    {firstMedia.type === "video" ? <video src={firstMedia.url} /> : <img src={firstMedia.url} alt="Explore" />}
                    <div className="ig-tile-overlay">
                      <span>❤️ {p.likes?.length || 0}</span>
                      <span>💬 {p.comments?.length || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. REELS VERTICAL FEED */}
        {activeTab === "reels" && (
          <div className="reels-scroller">
            {reels.length === 0 ? (
              <div style={{ color: "#fff", textAlign: "center", padding: "120px 20px" }}>
                <h3>No Reels Yet</h3>
                <p style={{ fontSize: "13px", marginTop: "8px", color: "#aaa" }}>Go to Create tab and upload a video with "Share as Reel" checked!</p>
              </div>
            ) : (
              reels.map((r) => {
                const videoUrl = r.media?.[0]?.url || r.image_url;
                const isLiked = r.likes?.includes(currentUser);
                return (
                  <div key={r._id} className="reel-card">
                    <video src={videoUrl} controls loop playsInline onPlay={() => fetch(`${API_URL}/reels/${r._id}/view`, { method: "POST" })} />
                    <div className="reel-overlay">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <strong style={{ cursor: "pointer" }} onClick={() => openProfile(r.username)}>@{r.username}</strong>
                          <span style={{ fontSize: "11px", color: "#ccc" }}>• {formatTimeAgo(r.created_at)}</span>
                          {r.username !== currentUser && (
                            <button className="ig-btn-blue" style={{ padding: "3px 10px", fontSize: "12px" }} onClick={() => handleFollow(r.username)}>Follow</button>
                          )}
                        </div>
                        <p style={{ fontSize: "13px", marginBottom: "6px" }}>{r.caption}</p>
                        <div style={{ fontSize: "11px", color: "#ccc" }}>🎵 Original Audio • 👁️ {r.views || 0} views</div>
                      </div>

                      <div className="reel-side-actions">
                        <button className="ig-svg-btn" style={{ color: "#fff", flexDirection: "column" }} onClick={() => handleLike(r._id)}>
                          <Icons.Heart liked={isLiked} />
                          <span style={{ fontSize: "12px" }}>{r.likes?.length || 0}</span>
                        </button>
                        <button className="ig-svg-btn" style={{ color: "#fff", flexDirection: "column" }} onClick={() => setSelectedPostModal(r)}>
                          <Icons.Comment />
                          <span style={{ fontSize: "12px" }}>{r.comments?.length || 0}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 5. MESSAGES / DM + STICKY HEADER + CALL LOGS */}
        {activeTab === "messages" && (
          <div className={`ig-inbox ${activeChatLiveUser ? "chat-open" : ""}`}>
            <div className="ig-inbox-list">
              <div style={{ padding: "18px", fontWeight: "700", borderBottom: "1px solid var(--border-line)" }}>{currentUser}</div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {allUsers.filter((u) => u.username !== currentUser).map((u) => {
                  const isFollowing = u.followers?.includes(currentUser) || meObj?.following?.includes(u.username);
                  const statusInfo = getOnlineStatus(u.last_seen);
                  return (
                    <div key={u._id} className={`ig-thread-row ${activeChatLiveUser?.username === u.username ? "active" : ""}`} onClick={() => { setSelectedChatUser(u); fetchMessages(u.username); }}>
                      <div className="avatar-status-wrap">
                        <div className="ig-avatar-44">{u.username[0]}</div>
                        {isFollowing && statusInfo.isOnline && <span className="online-green-dot" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "600", fontSize: "14px" }}>{u.username}</span>
                          {u.last_msg_time && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTimeAgo(u.last_msg_time)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: statusInfo.isOnline && isFollowing ? "#1ed760" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u.last_msg_text ? u.last_msg_text : isFollowing ? statusInfo.label : "Tap to chat"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ig-chat-pane">
              {activeChatLiveUser ? (
                <>
                  <div className="ig-chat-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button className="mobile-back-btn" onClick={() => setSelectedChatUser(null)}>←</button>
                      <div className="avatar-status-wrap">
                        <div className="ig-avatar-32">{activeChatLiveUser.username[0]}</div>
                        {getOnlineStatus(activeChatLiveUser.last_seen).isOnline && <span className="online-green-dot" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "14px", cursor: "pointer" }} onClick={() => openProfile(activeChatLiveUser.username)}>
                          {activeChatLiveUser.username}
                        </div>
                        <div style={{ fontSize: "11px", color: getOnlineStatus(activeChatLiveUser.last_seen).isOnline ? "#1ed760" : "var(--text-muted)" }}>
                          {getOnlineStatus(activeChatLiveUser.last_seen).label}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <button className="ig-svg-btn" title="Audio Call" onClick={() => startCall(activeChatLiveUser, "audio")}>
                        <Icons.Phone />
                      </button>
                      <button className="ig-svg-btn" title="Video Call" onClick={() => startCall(activeChatLiveUser, "video")}>
                        <Icons.VideoCall />
                      </button>
                    </div>
                  </div>

                  <div className="ig-chat-scroll">
                    {messages.map((m) => {
                      const isMe = m.sender === currentUser;
                      return (
                        <div key={m._id} className={`ig-bubble-wrap ${isMe ? "me" : "them"}`}>
                          {m.reply_to_text && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>Replied to: {m.reply_to_text}</div>
                          )}
                          <div className={`ig-bubble ${isMe ? "me" : "them"}`}>
                            {m.media_url && <img src={m.media_url} alt="Chat media" style={{ maxWidth: "200px", borderRadius: "10px", display: "block", marginBottom: m.text ? "6px" : "0" }} />}
                            {m.text}
                          </div>
                          <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", alignItems: "center" }}>
                            {m.created_at && <span>{formatChatTime(m.created_at)}</span>}
                            {m.reactions?.map((r, i) => <span key={i}>{r.emoji}</span>)}
                            <span style={{ cursor: "pointer" }} onClick={() => handleReactMsg(m._id, "❤️")}>❤️</span>
                            <span style={{ cursor: "pointer" }} onClick={() => setReplyToMsg(m.text)}>Reply</span>
                            {isMe && <span style={{ cursor: "pointer", color: "#ff3040" }} onClick={() => handleUnsendMsg(m._id)}>Unsend</span>}
                            {isMe && m.seen && <span>• Seen</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {replyToMsg && (
                    <div style={{ padding: "6px 18px", background: "var(--bg-hover)", fontSize: "12px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
                      <span>Replying to: <strong>{replyToMsg}</strong></span>
                      <span style={{ cursor: "pointer" }} onClick={() => setReplyToMsg("")}>✕</span>
                    </div>
                  )}

                  <form className="ig-chat-pill" onSubmit={handleSendDM}>
                    <label style={{ cursor: "pointer", fontSize: "18px" }} title="Send Photo">
                      🖼️
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleSendChatImage} />
                    </label>
                    <input placeholder="Message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                    {newMessage.trim() && <button type="submit" className="ig-link-btn">Send</button>}
                  </form>
                </>
              ) : (
                <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)" }}>
                  <h3>Your Messages</h3>
                  <p style={{ fontSize: "13px" }}>Send private photos, messages, or start a live video call.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div className="ig-feed-column" style={{ padding: "0 12px" }}>
            <h2 style={{ marginBottom: "16px" }}>Notifications</h2>
            {meObj?.follow_requests?.length > 0 && (
              <div style={{ padding: "12px", border: "1px solid var(--border-line)", borderRadius: "8px", marginBottom: "16px" }}>
                <h4 style={{ marginBottom: "10px" }}>Follow Requests ({meObj.follow_requests.length})</h4>
                {meObj.follow_requests.map((reqUser) => (
                  <div key={reqUser} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong>@{reqUser}</strong>
                    <button className="ig-btn-blue" onClick={() => handleAcceptRequest(reqUser)}>Confirm</button>
                  </div>
                ))}
              </div>
            )}

            {notifications.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n._id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid var(--border-line)" }}>
                  <div className="ig-avatar-32">{n.actor[0]}</div>
                  <div style={{ fontSize: "14px" }}>
                    <strong style={{ cursor: "pointer" }} onClick={() => openProfile(n.actor)}>{n.actor}</strong> {n.text}{" "}
                    {n.created_at && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>• {formatTimeAgo(n.created_at)}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 7. CREATE POST */}
        {activeTab === "create" && (
          <div className="ig-feed-column" style={{ padding: "0 12px" }}>
            <div style={{ border: "1px solid var(--border-line)", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ marginBottom: "16px" }}>Create new post</h3>
              <form onSubmit={handleCreatePost}>
                <label style={{ fontSize: "13px", color: "var(--text-muted)" }}>Select Image(s) for Carousel or a Video:</label>
                <input className="ig-input" type="file" accept="image/*,video/*" multiple required onChange={(e) => setPostFiles(e.target.files)} />
                <input className="ig-input" type="text" placeholder="Write a caption (use #hashtags and @mentions)..." value={caption} onChange={(e) => setCaption(e.target.value)} />
                <input className="ig-input" type="text" placeholder="Add location (e.g., Solapur, Maharashtra)" value={location} onChange={(e) => setLocation(e.target.value)} />
                <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "10px 0", fontSize: "14px" }}>
                  <input type="checkbox" checked={isReelUpload} onChange={(e) => setIsReelUpload(e.target.checked)} />
                  Share video as a Reel 🎬
                </label>
                <button type="submit" className="ig-btn-blue" style={{ width: "100%", padding: "10px", marginTop: "8px" }} disabled={uploading}>
                  {uploading ? "Uploading..." : "Share"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 8. PROFILE PAGE */}
        {activeTab === "profile" && profileData && (
          <div className="ig-profile-container">
            <div className="ig-profile-top">
              <div>
                {profileData.user.profile_pic ? (
                  <img src={profileData.user.profile_pic} alt="DP" className="ig-dp-150" />
                ) : (
                  <div className="ig-dp-150">{profileData.user.username[0]}</div>
                )}
                {viewedUsername === currentUser && (
                  <label style={{ display: "block", textAlign: "center", color: "#0095f6", fontSize: "13px", fontWeight: "600", marginTop: "8px", cursor: "pointer" }}>
                    Change photo
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
                  </label>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "20px" }}>{profileData.user.username}</span>
                  {profileData.user.is_private && <span style={{ fontSize: "12px", background: "var(--bg-input)", padding: "2px 8px", borderRadius: "12px" }}>🔒 Private</span>}
                  {viewedUsername !== currentUser && (
                    <span style={{ fontSize: "12px", color: getOnlineStatus(profileData.user.last_seen).isOnline ? "#1ed760" : "var(--text-muted)" }}>
                      • {getOnlineStatus(profileData.user.last_seen).label}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  {viewedUsername === currentUser ? (
                    <>
                      <button className="ig-btn-gray" onClick={() => setIsEditingProfile(!isEditingProfile)}>
                        {isEditingProfile ? "Cancel" : "Edit profile"}
                      </button>
                      <button className="ig-btn-gray" onClick={() => setActiveTab("settings")} title="Settings">⚙️</button>
                      <button className="ig-btn-gray" style={{ color: "#ff3040" }} onClick={handleLogout}>Logout</button>
                    </>
                  ) : (
                    <>
                      <button className={profileData.user.followers?.includes(currentUser) ? "ig-btn-gray" : "ig-btn-blue"} onClick={() => handleFollow(viewedUsername)}>
                        {profileData.user.followers?.includes(currentUser) ? "Following" : profileData.user.follow_requests?.includes(currentUser) ? "Requested" : "Follow"}
                      </button>
                      {profileData.can_view && (
                        <>
                          <button className="ig-btn-gray" onClick={() => { setActiveTab("messages"); setSelectedChatUser(profileData.user); }}>Message</button>
                          <button className="ig-btn-gray" onClick={() => startCall(profileData.user, "video")}>📹 Call</button>
                        </>
                      )}
                      <button className="ig-btn-gray" style={{ color: "#ff3040" }} onClick={() => handleBlockUser(viewedUsername)}>Block</button>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: "24px", margin: "16px 0", fontSize: "15px" }}>
                  <span><strong>{profileData.posts.length}</strong> posts</span>
                  <span style={{ cursor: "pointer" }} onClick={() => setListModal({ title: "Followers", users: profileData.user.followers || [] })}>
                    <strong>{profileData.user.followers?.length || 0}</strong> followers
                  </span>
                  <span style={{ cursor: "pointer" }} onClick={() => setListModal({ title: "Following", users: profileData.user.following || [] })}>
                    <strong>{profileData.user.following?.length || 0}</strong> following
                  </span>
                </div>

                {isEditingProfile ? (
                  <form onSubmit={handleProfileUpdate} style={{ maxWidth: "360px", margin: "0 auto" }}>
                    <input className="ig-input" placeholder="Full Name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                    <input className="ig-input" placeholder="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0", fontSize: "14px" }}>
                      <input type="checkbox" checked={editForm.is_private} onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })} />
                      Private Account
                    </label>
                    <button type="submit" className="ig-btn-blue">Save</button>
                  </form>
                ) : (
                  <div style={{ fontSize: "14px" }}>
                    <div style={{ fontWeight: "600" }}>{profileData.user.full_name}</div>
                    <div style={{ marginTop: "4px" }}>{profileData.user.bio}</div>
                  </div>
                )}
              </div>
            </div>

            {profileData.user.highlights?.length > 0 && (
              <div className="ig-stories" style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-line)" }}>
                {profileData.user.highlights.map((h, i) => (
                  <div key={i} className="ig-story-unit">
                    <div className="ig-gradient-ring plain"><img src={h.cover_url} alt={h.title} className="ig-story-img" /></div>
                    <span className="ig-story-name">{h.title}</span>
                  </div>
                ))}
              </div>
            )}

            {!profileData.can_view ? (
              <div style={{ textAlign: "center", padding: "50px 20px" }}>
                <h3>🔒 This Account is Private</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "6px" }}>Follow this account to see their photos and videos.</p>
              </div>
            ) : (
              <>
                <div className="profile-subtabs">
                  <button className={`subtab-btn ${profileSubTab === "posts" ? "active" : ""}`} onClick={() => setProfileSubTab("posts")}>POSTS</button>
                  {viewedUsername === currentUser && (
                    <button className={`subtab-btn ${profileSubTab === "saved" ? "active" : ""}`} onClick={() => setProfileSubTab("saved")}>SAVED</button>
                  )}
                  <button className={`subtab-btn ${profileSubTab === "tagged" ? "active" : ""}`} onClick={() => setProfileSubTab("tagged")}>TAGGED</button>
                </div>

                <div className="ig-grid-3">
                  {(profileSubTab === "posts" ? profileData.posts : profileSubTab === "saved" ? profileData.saved_posts : profileData.tagged_posts).map((p) => (
                    <div key={p._id} className="ig-grid-tile" onClick={() => setSelectedPostModal(p)}>
                      <img src={(p.media?.[0]?.url) || p.image_url} alt="Tile" />
                      <div className="ig-tile-overlay">
                        <span>❤️ {p.likes?.length || 0}</span>
                        <span>💬 {p.comments?.length || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 9. SETTINGS */}
        {activeTab === "settings" && (
          <div className="ig-feed-column" style={{ padding: "0 12px" }}>
            <h2 style={{ marginBottom: "20px" }}>Privacy & Security</h2>
            <div style={{ border: "1px solid var(--border-line)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "10px" }}>Change Password</h4>
              <form onSubmit={handleChangePassword}>
                <input className="ig-input" type="password" placeholder="Current password" required value={passForm.old_password} onChange={(e) => setPassForm({ ...passForm, old_password: e.target.value })} />
                <input className="ig-input" type="password" placeholder="New password" required value={passForm.new_password} onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })} />
                <button type="submit" className="ig-btn-blue" style={{ marginTop: "8px" }}>Update Password</button>
              </form>
            </div>

            <div style={{ border: "1px solid var(--border-line)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <h4 style={{ marginBottom: "10px" }}>Blocked Accounts</h4>
              {meObj?.blocked_users?.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No blocked accounts.</p>
              ) : (
                meObj?.blocked_users?.map((bUser) => (
                  <div key={bUser} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span>@{bUser}</span>
                    <button className="ig-btn-gray" onClick={() => handleBlockUser(bUser)}>Unblock</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ border: "1px solid var(--border-line)", borderRadius: "8px", padding: "16px" }}>
              <h4 style={{ marginBottom: "10px" }}>Recent Login Activity</h4>
              {meObj?.login_activity?.slice().reverse().map((act, idx) => (
                <div key={idx} style={{ fontSize: "13px", padding: "8px 0", borderBottom: "1px solid var(--border-line)" }}>
                  <div><strong>IP:</strong> {act.ip}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{act.device} • {formatTimeAgo(act.time)}</div>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid #ff3040", borderRadius: "8px", padding: "16px", marginTop: "20px" }}>
              <h4 style={{ marginBottom: "6px", color: "#ff3040" }}>Delete Account</h4>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
                Permanently delete your Pixagram account, posts, stories, and messages. Enter your password to confirm.
              </p>
              <form onSubmit={handleDeleteAccount}>
                <input
                  className="ig-input"
                  type="password"
                  placeholder="Enter password to confirm"
                  required
                  value={deletePass}
                  onChange={(e) => setDeletePass(e.target.value)}
                />
                <button
                  type="submit"
                  className="ig-btn-blue"
                  style={{ background: "#ff3040", marginTop: "8px" }}
                >
                  Permanently Delete Account
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* --- INCOMING CALL RINGING MODAL --- */}
      {incomingCall && !activeCall && (
        <div className="ig-backdrop">
          <div className="ig-call-ring-card">
            <div className="ig-avatar-44" style={{ width: "74px", height: "74px", fontSize: "30px", margin: "0 auto 14px" }}>
              {incomingCall.caller[0]}
            </div>
            <h3>@{incomingCall.caller}</h3>
            <p style={{ color: "#aaa", fontSize: "14px", marginTop: "6px" }}>
              Incoming Pixagram {incomingCall.call_type === "video" ? "Video" : "Audio"} Call...
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "24px" }}>
              <button className="call-btn-decline" onClick={() => endOrDeclineCall(incomingCall._id)}>Decline</button>
              <button className="call-btn-accept" onClick={acceptIncomingCall}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ACTIVE LIVE CALL SCREEN --- */}
      {activeCall && (
        <div className="ig-backdrop">
          <div className="ig-active-call-box">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video-stream"
              style={{ display: activeCall.call_type === "video" ? "block" : "none" }}
            />
            {activeCall.call_type === "audio" && (
              <div style={{ margin: "auto", textAlign: "center", color: "#fff" }}>
                <div className="ig-avatar-44" style={{ width: "90px", height: "90px", fontSize: "36px", margin: "0 auto 14px" }}>
                  {activeCall.peerUser[0]}
                </div>
                <h3>@{activeCall.peerUser}</h3>
                <p style={{ color: "#1ed760", fontSize: "13px", marginTop: "6px" }}>
                  {activeCall.status === "ringing" ? "Ringing..." : "● Audio Call Connected"}
                </p>
              </div>
            )}

            {activeCall.call_type === "video" && (
              <video ref={localVideoRef} autoPlay muted playsInline className="local-video-pip" />
            )}

            <div className="call-top-overlay">
              <strong>@{activeCall.peerUser}</strong>
              <span style={{ fontSize: "13px", color: "#1ed760" }}>
                {activeCall.status === "ringing" ? "Ringing..." : "● Connected"}
              </span>
            </div>

            <div className="call-bottom-controls" style={{ gap: "10px", padding: "0 12px" }}>
              <button
                className="call-ctrl-btn"
                style={{ background: isMuted ? "#fff" : "rgba(255,255,255,0.2)", color: isMuted ? "#000" : "#fff" }}
                onClick={toggleMute}
              >
                {isMuted ? "🔇 Unmute" : "🎙️ Mute"}
              </button>

              <button
                className="call-ctrl-btn"
                style={{ background: isSpeakerOn ? "#fff" : "rgba(255,255,255,0.2)", color: isSpeakerOn ? "#000" : "#fff" }}
                onClick={toggleSpeaker}
              >
                {isSpeakerOn ? "🔊 Speaker" : "🔈 Phone"}
              </button>

              {activeCall.call_type === "video" && (
                <button
                  className="call-ctrl-btn"
                  style={{ background: isCamOff ? "#fff" : "rgba(255,255,255,0.2)", color: isCamOff ? "#000" : "#fff" }}
                  onClick={toggleCamera}
                >
                  {isCamOff ? "📷 Cam On" : "🚫 Cam Off"}
                </button>
              )}

              <button className="call-btn-decline" onClick={() => endOrDeclineCall(activeCall.call_id)}>
                End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- STORY CREATOR MODAL --- */}
      {showStoryCreator && (
        <div className="ig-backdrop" onClick={() => setShowStoryCreator(false)}>
          <div className="ig-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: "12px" }}>Add to Story</h3>
            <form onSubmit={handleCreateStory}>
              <input className="ig-input" type="file" accept="image/*,video/*" required onChange={(e) => setStoryForm({ ...storyForm, file: e.target.files[0] })} />
              <input className="ig-input" placeholder="Text overlay / Caption..." onChange={(e) => setStoryForm({ ...storyForm, caption: e.target.value })} />
              <input className="ig-input" placeholder="🎵 Add Music Track Name..." onChange={(e) => setStoryForm({ ...storyForm, music_name: e.target.value })} />
              <input className="ig-input" placeholder="📊 Interactive Poll Question (Optional)" onChange={(e) => setStoryForm({ ...storyForm, poll_question: e.target.value })} />
              {storyForm.poll_question && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="ig-input" value={storyForm.poll_opt1} onChange={(e) => setStoryForm({ ...storyForm, poll_opt1: e.target.value })} />
                  <input className="ig-input" value={storyForm.poll_opt2} onChange={(e) => setStoryForm({ ...storyForm, poll_opt2: e.target.value })} />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", margin: "10px 0", fontSize: "13px" }}>
                <input type="checkbox" onChange={(e) => setStoryForm({ ...storyForm, close_friends_only: e.target.checked })} />
                Share with Close Friends only 💚
              </label>
              <button type="submit" className="ig-btn-blue" style={{ width: "100%", padding: "10px" }}>Share Story</button>
            </form>
          </div>
        </div>
      )}

      {/* --- STORY VIEWER WITH TIMESTAMP & PROGRESS BARS --- */}
      {activeStory && (
        <div className="ig-backdrop" onClick={() => setActiveStoryIndex(null)}>
          <div style={{ width: "94%", maxWidth: "360px", height: "84vh", background: "#000", borderRadius: "12px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "10px 14px", background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)", color: "#fff", zIndex: 10 }}>
              <div className="story-progress-row">
                {stories.map((_, i) => (
                  <div key={i} className="story-progress-track">
                    <div
                      className="story-progress-fill"
                      style={{
                        width: i < activeStoryIndex ? "100%" : i === activeStoryIndex ? `${storyProgress}%` : "0%",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <div>
                  <strong>@{activeStory.username} {activeStory.close_friends_only && "💚"}</strong>
                  {activeStory.created_at && (
                    <span style={{ fontSize: "11px", color: "#ccc", marginLeft: "6px" }}>
                      {formatTimeAgo(activeStory.created_at)}
                    </span>
                  )}
                </div>
                <button onClick={() => setActiveStoryIndex(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>✕</button>
              </div>
              {activeStory.music_name && <div style={{ fontSize: "12px", marginTop: "4px" }}>🎵 {activeStory.music_name}</div>}
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }} onClick={handleStoryTapNavigation}>
              {activeStory.media_type === "video" ? (
                <video src={activeStory.media_url} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <img src={activeStory.media_url} alt="Story" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              )}

              {activeStory.caption && (
                <div style={{ position: "absolute", bottom: "130px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "6px 14px", borderRadius: "8px" }}>
                  {activeStory.caption}
                </div>
              )}

              {activeStory.poll && (
                <div style={{ position: "absolute", bottom: "50px", background: "#fff", color: "#000", padding: "12px", borderRadius: "12px", width: "82%", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontWeight: "700", marginBottom: "8px", fontSize: "14px" }}>{activeStory.poll.question}</div>
                  {activeStory.poll.options.map((opt, idx) => (
                    <button key={idx} style={{ width: "100%", padding: "8px", margin: "4px 0", borderRadius: "6px", border: "1px solid #ddd", cursor: "pointer", fontWeight: "600" }} onClick={() => handleVotePoll(activeStory._id, idx)}>
                      {opt.text} ({opt.votes.length} votes)
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "12px", background: "#111", color: "#fff" }}>
              {activeStory.username === currentUser ? (
                <div>
                  <div style={{ fontSize: "12px", marginBottom: "8px" }}>👁️ Viewed by: {activeStory.viewers?.join(", ") || "No viewers yet"}</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "none" }} placeholder="Highlight title..." value={highlightTitle} onChange={(e) => setHighlightTitle(e.target.value)} />
                    <button className="ig-btn-blue" onClick={handleSaveHighlight}>+ Highlight</button>
                  </div>
                </div>
              ) : (
                <form style={{ display: "flex", gap: "8px" }} onSubmit={handleStoryReply}>
                  <input style={{ flex: 1, padding: "8px 12px", borderRadius: "20px", border: "1px solid #444", background: "transparent", color: "#fff" }} placeholder="Send message..." value={storyReplyText} onChange={(e) => setStoryReplyText(e.target.value)} />
                  <button type="submit" className="ig-link-btn">Send</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {editingPost && (
        <div className="ig-backdrop" onClick={() => setEditingPost(null)}>
          <div className="ig-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: "12px" }}>Edit Post</h3>
            <form onSubmit={handleEditPostSave}>
              <input className="ig-input" value={editingPost.caption} onChange={(e) => setEditingPost({ ...editingPost, caption: e.target.value })} />
              <input className="ig-input" placeholder="Location" value={editingPost.location} onChange={(e) => setEditingPost({ ...editingPost, location: e.target.value })} />
              <button type="submit" className="ig-btn-blue" style={{ marginTop: "10px" }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {listModal && (
        <div className="ig-backdrop" onClick={() => setListModal(null)}>
          <div className="ig-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3>{listModal.title}</h3>
              <button onClick={() => setListModal(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>
            {listModal.users.map((u) => (
              <div key={u} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-line)", cursor: "pointer" }} onClick={() => { setListModal(null); openProfile(u); }}>
                <strong>@{u}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPostModal && (
        <div className="ig-backdrop" onClick={() => setSelectedPostModal(null)}>
          <div className="ig-post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ig-post-modal-left">
              <img src={(selectedPostModal.media?.[0]?.url) || selectedPostModal.image_url} alt="Detail" />
            </div>
            <div className="ig-post-modal-right">
              <div style={{ padding: "14px", borderBottom: "1px solid var(--border-line)", display: "flex", justifyContent: "space-between" }}>
                <strong>{selectedPostModal.username} • {formatTimeAgo(selectedPostModal.created_at)}</strong>
                <button onClick={() => setSelectedPostModal(null)} style={{ background: "none", border: "none", color: "var(--text-main)", fontSize: "18px", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, padding: "14px", overflowY: "auto", fontSize: "14px" }}>
                <p style={{ marginBottom: "12px" }}><strong>{selectedPostModal.username}</strong> {selectedPostModal.caption}</p>
                {selectedPostModal.comments?.map((c, idx) => (
                  <p key={idx} style={{ marginBottom: "8px" }}>
                    <strong>{c.username}</strong> {c.text}{" "}
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTimeAgo(c.created_at)}</span>
                  </p>
                ))}
              </div>
              <form style={{ display: "flex", padding: "12px", borderTop: "1px solid var(--border-line)" }} onSubmit={(e) => handleComment(e, selectedPostModal._id)}>
                <input style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-main)" }} placeholder="Add a comment..." value={commentText[selectedPostModal._id] || ""} onChange={(e) => setCommentText({ ...commentText, [selectedPostModal._id]: e.target.value })} />
                <button type="submit" className="ig-link-btn">Post</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;