export const API_URL = "https://insta-clone-fullstack-0t7a.onrender.com";

export const formatTimeAgo = (isoString) => {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export const formatChatTime = (isoString) => {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getOnlineStatus = (lastSeenIso) => {
  if (!lastSeenIso) return { isOnline: false, label: "Offline" };
  const diffSec = Math.floor((Date.now() - new Date(lastSeenIso).getTime()) / 1000);
  if (diffSec <= 45) return { isOnline: true, label: "Active now" };
  if (diffSec < 3600) return { isOnline: false, label: `Active ${Math.max(1, Math.floor(diffSec / 60))}m ago` };
  if (diffSec < 86400) return { isOnline: false, label: `Active ${Math.floor(diffSec / 3600)}h ago` };
  return { isOnline: false, label: "Offline" };
};