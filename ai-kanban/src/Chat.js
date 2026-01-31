import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./Chat.css";

/**
 * tables:
 * - profiles: { id (uuid), username (text) }
 * - conversations: { id (uuid), user_a (uuid), user_b (uuid), updated_at (timestamptz) }
 * - chat: { id (uuid), conversation_id (uuid), sender_id (uuid), recipient_id (uuid),
 *           message (text), message_type (text), created_at (timestamptz),
 *           delivered_at (timestamptz), read_at (timestamptz) }
 */

// ---------- AI (virtual conversation) ----------
const AI_CONVO_ID = "ai";
const AI_CONTACT = { id: "ai", username: "KIRO AI" };

export default function Chat() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeOtherUser, setActiveOtherUser] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const isAIChat = activeConversationId === AI_CONVO_ID;

  // sidebar search
  const [sidebarQuery, setSidebarQuery] = useState("");

  // header message search (🔍 beside gear)
  const [isMsgSearchOpen, setIsMsgSearchOpen] = useState(false);
  const [msgQuery, setMsgQuery] = useState("");

  // modal: add contact / new chat
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const messagesRef = useRef(null);

  // ✅ always go back to organisation page (NOT history back)
  const goBackToOrganisation = () => {
    navigate("/organisation"); // change if your org route differs
  };

  // -------------------------
  // Helpers
  // -------------------------
  const getInitials = (name) => {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase().slice(0, 2);
  };

  const randInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };

  const randomNiceColor = () => {
    const h = randInt(0, 360);
    const s = randInt(65, 90);
    const l = randInt(42, 62);
    return hslToHex(h, s, l);
  };

  // stable per-user gradient stored in localStorage
  const getUserGradient = (key) => {
    const storageKey = `grad:${key}`;
    const cached = localStorage.getItem(storageKey);
    if (cached) return cached;

    const angle = randInt(0, 360);
    const c1 = randomNiceColor();
    const c2 = randomNiceColor();
    const grad = `linear-gradient(${angle}deg, ${c1}, ${c2})`;

    localStorage.setItem(storageKey, grad);
    return grad;
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDayLabel = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return "TODAY";
    return d.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const scrollToBottom = (smooth = true) => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // -------------------------
  // Auth
  // -------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // -------------------------
  // Load conversations (with preview + other profile)
  // -------------------------
  const loadConversations = async (u) => {
    if (!u) return;

    const { data: convs, error } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, updated_at, created_at")
      .or(`user_a.eq.${u.id},user_b.eq.${u.id}`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("loadConversations error:", error);
      setConversations([]);
      return;
    }

    const rows = convs || [];
    const otherIds = [
      ...new Set(rows.map((c) => (c.user_a === u.id ? c.user_b : c.user_a))),
    ];

    if (otherIds.length === 0) {
      setConversations([]);
      setActiveConversationId(null);
      setActiveOtherUser(null);
      setMessages([]);
      return;
    }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", otherIds);

    if (pErr) console.error("profiles fetch error:", pErr);

    const profileMap = new Map((profs || []).map((p) => [p.id, p]));

    const formatted = [];
    for (const c of rows) {
      const otherId = c.user_a === u.id ? c.user_b : c.user_a;
      const other =
        profileMap.get(otherId) || { id: otherId, username: "Unknown" };

      const { data: lastMsg } = await supabase
        .from("chat")
        .select("message, created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const last = lastMsg?.[0];

      formatted.push({
        id: c.id,
        otherUser: other,
        updated_at: c.updated_at,
        preview: last?.message ?? "",
        time: formatTime(last?.created_at || c.updated_at),
      });
    }

    setConversations(formatted);

    if (!activeConversationId && formatted.length) {
      setActiveConversationId(formatted[0].id);
      setActiveOtherUser(formatted[0].otherUser);
    } else if (activeConversationId) {
      const active = formatted.find((x) => x.id === activeConversationId);
      if (active) setActiveOtherUser(active.otherUser);
    }
  };

  const markAsRead = async () => {
    if (!user || !activeConversationId) return;
    if (activeConversationId === AI_CONVO_ID) return;

    const { error } = await supabase
      .from("chat")
      .update({
        read_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      })
      .eq("conversation_id", activeConversationId)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (error) console.error("markAsRead error:", error);
  };

  useEffect(() => {
    if (!user) return;
    loadConversations(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // close/clear header message search when switching chats
  useEffect(() => {
    setMsgQuery("");
    setIsMsgSearchOpen(false);
  }, [activeConversationId]);

  // -------------------------
  // Realtime subscription
  // -------------------------
  useEffect(() => {
    if (!user || !activeConversationId) return;
    if (activeConversationId === AI_CONVO_ID) return;

    const channel = supabase
      .channel(`chat:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        async (payload) => {
          const m = payload.new;

          if (m.sender_id !== user.id && m.recipient_id !== user.id) return;

          if (m.recipient_id === user.id && !m.delivered_at) {
            await supabase
              .from("chat")
              .update({ delivered_at: new Date().toISOString() })
              .eq("id", m.id);
          }

          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                text: m.message,
                sent: m.sender_id === user.id,
                created_at: m.created_at,
                delivered_at: m.delivered_at,
                read_at: m.read_at,
              },
            ];
          });

          setConversations((prev) => {
            const nowIso = m.created_at;
            const next = prev.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    preview: m.message,
                    time: formatTime(nowIso),
                    updated_at: nowIso,
                  }
                : c
            );
            next.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            return next;
          });

          setTimeout(() => scrollToBottom(true), 30);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversationId]);

  // -------------------------
  // Load messages
  // -------------------------
  useEffect(() => {
    if (!user || !activeConversationId) return;
    if (activeConversationId === AI_CONVO_ID) return;

    (async () => {
      const { data, error } = await supabase
        .from("chat")
        .select(
          "id, message, sender_id, recipient_id, created_at, delivered_at, read_at"
        )
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("loadMessages error:", error);
        setMessages([]);
        return;
      }

      setMessages(
        (data || []).map((m) => ({
          id: m.id,
          text: m.message,
          sent: m.sender_id === user.id,
          created_at: m.created_at,
          delivered_at: m.delivered_at,
          read_at: m.read_at,
        }))
      );

      setTimeout(() => scrollToBottom(false), 10);
      markAsRead();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeConversationId]);

  // -------------------------
  // Send message (DB)
  // -------------------------
  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || !activeConversationId || !activeOtherUser?.id)
      return;
    if (activeConversationId === AI_CONVO_ID) return;

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: trimmed,
        sent: true,
        created_at: nowIso,
        delivered_at: null,
        read_at: null,
        optimistic: true,
      },
    ]);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, preview: trimmed, time: formatTime(nowIso), updated_at: nowIso }
          : c
      )
    );

    setText("");
    setTimeout(() => scrollToBottom(true), 0);

    const { data, error } = await supabase
      .from("chat")
      .insert([
        {
          conversation_id: activeConversationId,
          message: trimmed,
          message_type: "text",
          sender_id: user.id,
          recipient_id: activeOtherUser.id,
        },
      ])
      .select("id, created_at, delivered_at, read_at")
      .single();

    if (error) {
      console.error("sendMessage error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? {
              ...m,
              id: data.id,
              created_at: data.created_at,
              delivered_at: data.delivered_at,
              read_at: data.read_at,
              optimistic: false,
            }
          : m
      )
    );

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", activeConversationId);
  };

  // -------------------------
  // Send message (AI)
  // -------------------------
  const sendAIMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    const nowIso = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, text: trimmed, sent: true, created_at: nowIso },
    ]);

    setText("");
    setTimeout(() => scrollToBottom(true), 0);

try {
  const API_BASE =
    process.env.REACT_APP_SERVER_URL ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000";

  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: user.id, message: trimmed }),
  });

  const data = await res.json().catch(() => ({}));

  setMessages((prev) => [
    ...prev,
    {
      id: `ai-${Date.now()}`,
      text: res.ok ? data.reply : `AI error: ${data?.error || res.status}`,
      sent: false,
      created_at: new Date().toISOString(),
    },
  ]);

  setTimeout(() => scrollToBottom(true), 30);
} catch (err) {
  console.error("AI fetch failed:", err);

  setMessages((prev) => [
    ...prev,
    {
      id: `ai-error-${Date.now()}`,
      text: `AI is unavailable: ${err?.message || "network error"}`,
      sent: false,
      created_at: new Date().toISOString(),
    },
  ]);
}

  // -------------------------
  // Modal: search users
  // -------------------------
  const searchUsers = async (q) => {
    if (!user) return;

    const query = q.trim();
    if (!query) {
      setUserResults([]);
      return;
    }

    setLoadingUsers(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${query}%`)
      .limit(20);

    setLoadingUsers(false);

    if (error) {
      console.error("searchUsers error:", error);
      setUserResults([]);
      return;
    }

    setUserResults((data || []).filter((p) => p.id !== user.id));
  };

  // -------------------------
  // Create/Open conversation
  // -------------------------
  const createOrOpenConversation = async (otherProfile) => {
    if (!user || !otherProfile?.id) return;

    const { data: existing, error: exErr } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${otherProfile.id}),and(user_a.eq.${otherProfile.id},user_b.eq.${user.id})`
      )
      .maybeSingle();

    if (exErr) console.error("existing conversation check error:", exErr);

    let convId = existing?.id;

    if (!convId) {
      const { data: created, error: cErr } = await supabase
        .from("conversations")
        .insert([
          {
            user_a: user.id,
            user_b: otherProfile.id,
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (cErr) {
        console.error("create conversation error:", cErr);
        return;
      }
      convId = created.id;
    }

    setIsModalOpen(false);
    setUserSearch("");
    setUserResults([]);

    await loadConversations(user);

    setActiveConversationId(convId);
    setActiveOtherUser(otherProfile);
  };

  // -------------------------
  // UI derived
  // -------------------------
  const filteredConversations = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();

    const base = [
      {
        id: AI_CONVO_ID,
        otherUser: AI_CONTACT,
        preview: "Ask me anything…",
        time: "∞",
        updated_at: new Date().toISOString(),
        __isAI: true,
      },
      ...conversations,
    ];

    if (!q) return base;

    return base.filter((c) => {
      const name = (c.otherUser?.username || "").toLowerCase();
      const prev = (c.preview || "").toLowerCase();
      return name.includes(q) || prev.includes(q);
    });
  }, [conversations, sidebarQuery]);

  const headerName = activeOtherUser?.username || "Select a conversation";
  const headerInitials = getInitials(headerName);
  const headerGradient = activeOtherUser
    ? getUserGradient(activeOtherUser.id || headerName)
    : "linear-gradient(135deg,#aaa,#777)";

  // ✅ filter messages by header search query
  const displayedMessages = useMemo(() => {
    const q = msgQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      String(m.text || "").toLowerCase().includes(q)
    );
  }, [messages, msgQuery]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentLabel = null;

    for (const m of displayedMessages) {
      const label = formatDayLabel(m.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ type: "divider", label });
      }
      groups.push({ type: "msg", ...m });
    }
    return groups;
  }, [displayedMessages]);

  if (!user) {
    return (
      <div className="chat-shell">
        <div className="chat-login-card">
          <div className="chat-login-title">Please login</div>
          <div className="chat-login-sub">
            You must be authenticated to view messages.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      <div className="chat-layout">
        {/* Sidebar */}
        <aside className="chat-sidebar">
          <div className="sidebar-top">
            <div className="sidebar-title-row">
              <div className="sidebar-title-left">
                <button
                  className="icon-btn sidebar-back-btn no-jump"
                  title="Back to Organisation"
                  onClick={goBackToOrganisation}
                  type="button"
                >
                  ←
                </button>
                <div className="sidebar-title">Chats</div>
              </div>

              <button
                className="icon-btn"
                title="Add contact / new chat"
                onClick={() => setIsModalOpen(true)}
                type="button"
              >
                +
              </button>
            </div>

            <div className="sidebar-search">
              <span className="sidebar-search-icon">🔍</span>
              <input
                id="chat-search"
                name="chatSearch"
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                placeholder="Search chats..."
              />
            </div>
          </div>

          <div className="sidebar-list">
            {filteredConversations.map((c) => {
              const name = c.otherUser?.username || "Unknown";
              const initials = getInitials(name);
              const gradient =
                c.id === AI_CONVO_ID
                  ? "linear-gradient(135deg, #6c5ce7, #a29bfe)"
                  : getUserGradient(c.otherUser?.id || name);

              return (
                <button
                  key={c.id}
                  className={`chat-tile ${
                    c.id === activeConversationId ? "active" : ""
                  }`}
                  onClick={() => {
                    if (c.id === AI_CONVO_ID) {
                      setActiveConversationId(AI_CONVO_ID);
                      setActiveOtherUser(AI_CONTACT);
                      setMessages([]);
                      return;
                    }
                    setActiveConversationId(c.id);
                    setActiveOtherUser(c.otherUser);
                  }}
                >
                  <div className="tile-avatar" style={{ background: gradient }}>
                    {initials}
                  </div>

                  <div className="tile-body">
                    <div className="tile-row">
                      <div className="tile-name">{name}</div>
                      <div className="tile-time">{c.time || ""}</div>
                    </div>
                    <div className="tile-preview">{c.preview || ""}</div>
                  </div>
                </button>
              );
            })}

            {filteredConversations.length === 0 && (
              <div className="sidebar-empty">
                <div className="sidebar-empty-title">No chats</div>
                <div className="sidebar-empty-sub">
                  Click + to add a contact and start chatting.
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="chat-main">
          <header className="chat-header">
            <div className="header-left">
              <div className="header-avatar" style={{ background: headerGradient }}>
                {headerInitials}
              </div>

              <div className="header-meta">
                <div className="header-name">{headerName}</div>
                <div className="header-status">
                  {activeConversationId ? "Active" : "Select a chat to start"}
                </div>
              </div>
            </div>

            <div className="header-actions">
              {/* 🔍 message filter */}
              {isMsgSearchOpen && (
                <div className="header-msg-search">
                  <input
                    value={msgQuery}
                    onChange={(e) => setMsgQuery(e.target.value)}
                    placeholder="Search messages..."
                    disabled={!activeConversationId}
                  />

                  <button
                    className="msg-clear"
                    title="Clear"
                    onClick={() => setMsgQuery("")}
                    disabled={!msgQuery}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                className="icon-btn no-jump"
                title="Search messages"
                onClick={() => {
                  setIsMsgSearchOpen((v) => {
                    const next = !v;
                    if (!next) setMsgQuery("");
                    return next;
                  });
                }}
                type="button"
              >
                🔍
              </button>

              <button className="icon-btn no-jump" title="Settings" type="button">
                ⚙️
              </button>
            </div>
          </header>

          <section className="chat-messages" ref={messagesRef}>
            {!activeConversationId ? (
              <div className="empty-chat">
                <div className="empty-chat-title">No conversation selected</div>
                <div className="empty-chat-sub">
                  Pick a chat from the left or click + to add a contact.
                </div>
              </div>
            ) : msgQuery.trim() &&
              groupedMessages.filter((x) => x.type === "msg").length === 0 ? (
              <div className="empty-chat">
                <div className="empty-chat-title">No matches</div>
                <div className="empty-chat-sub">Try a different keyword.</div>
              </div>
            ) : (
              groupedMessages.map((item, idx) => {
                if (item.type === "divider") {
                  return (
                    <div key={`div-${item.label}-${idx}`} className="day-divider">
                      <span>{item.label}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className={`msg-row ${item.sent ? "sent" : "recv"}`}
                  >
                    <div className="msg-bubble">
                      <div className="msg-text">{item.text}</div>
                      <div className="msg-meta">
                        <span className="msg-time">{formatTime(item.created_at)}</span>
                        {item.sent ? (
                          <span
                            className={`msg-ticks ${
                              item.read_at
                                ? "read"
                                : item.delivered_at
                                ? "delivered"
                                : "sent"
                            }`}
                          >
                            {item.delivered_at ? "✓✓" : "✓"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <footer className="chat-input">
            <button className="icon-btn" title="Add" type="button">
              ＋
            </button>

            <textarea
              id="chat-message"
              name="chatMessage"
              className="chat-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              disabled={!activeConversationId}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  isAIChat ? sendAIMessage() : sendMessage();
                }
              }}
            />

            <button className="icon-btn" title="Mic" type="button">
              🎤
            </button>

            <button
              className="send-btn"
              onClick={() => (isAIChat ? sendAIMessage() : sendMessage())}
              disabled={!text.trim() || !activeConversationId}
              type="button"
            >
              ➤
            </button>
          </footer>
        </main>
      </div>

      {/* MODAL: Add Contact / New Chat */}
      {isModalOpen && (
        <div className="modal-overlay" onMouseDown={() => setIsModalOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Contact</div>
              <button
                className="icon-btn"
                onClick={() => setIsModalOpen(false)}
                title="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="modal-search">
              <input
                id="add-contact-search"
                name="addContactSearch"
                value={userSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  setUserSearch(v);
                  searchUsers(v);
                }}
                placeholder="Search by username..."
              />
            </div>

            <div className="modal-body">
              {loadingUsers && <div className="modal-hint">Searching…</div>}

              {!loadingUsers && userSearch.trim() && userResults.length === 0 && (
                <div className="modal-hint">No users found.</div>
              )}

              {userResults.map((p) => {
                const initials = getInitials(p.username);
                const gradient = getUserGradient(p.id);

                return (
                  <button
                    key={p.id}
                    className="contact-row"
                    onClick={() => createOrOpenConversation(p)}
                    type="button"
                  >
                    <div className="contact-avatar" style={{ background: gradient }}>
                      {initials}
                    </div>
                    <div className="contact-name">{p.username}</div>
                    <div className="contact-action">Start</div>
                  </button>
                );
              })}
            </div>

            <div className="modal-footer">
              <button
                className="modal-secondary"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }}