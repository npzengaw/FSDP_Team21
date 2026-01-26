import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";


import {
  getMyOrganisations,
  getMembers,
  createOrganisation,
  joinOrganisation,
  leaveOrganisation,
  deleteOrganisation,
} from "../organisation";

/* =========================
   tiny hook: responsive width
========================= */
function useWindowWidth() {
  const [w, setW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

/* =========================
   helpers
========================= */
function safeErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================
   toast component
========================= */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const tone = toast.tone || "neutral";
  const toneMap = {
    neutral: { bar: "rgba(17,24,39,0.14)" },
    success: { bar: "rgba(31,157,106,0.32)" },
    danger: { bar: "rgba(226,61,61,0.32)" },
    info: { bar: "rgba(79,124,247,0.30)" },
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 120,
        width: "min(440px, calc(100vw - 36px))",
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(17,24,39,0.14)",
        boxShadow: "0 22px 54px rgba(17,24,39,0.16)",
        backdropFilter: "blur(12px)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        overflow: "hidden",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        aria-hidden="true"
        style={{
          width: 6,
          borderRadius: 999,
          background: (toneMap[tone] || toneMap.neutral).bar,
          alignSelf: "stretch",
        }}
      />
      <div style={{ fontSize: 18, lineHeight: "18px", marginTop: 2 }}>
        {toast.icon || "✨"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 950, color: "#111827", fontSize: 13 }}>
          {toast.title || "Done"}
        </div>
        {toast.message && (
          <div
            style={{
              color: "rgba(17,24,39,0.72)",
              fontSize: 13,
              marginTop: 3,
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontWeight: 950,
          color: "rgba(17,24,39,0.55)",
          padding: 6,
          margin: -6,
          borderRadius: 10,
        }}
        aria-label="Close toast"
      >
        ✕
      </button>
    </div>
  );
}

/* =========================
   modal
========================= */
function Modal({ open, title, subtitle, children, footer, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(17,24,39,0.45)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(17,24,39,0.16)",
          boxShadow: "0 30px 90px rgba(17,24,39,0.28)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid rgba(17,24,39,0.08)",
          }}
        >
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontWeight: 950, color: "#111827" }}>{title}</div>
            {subtitle && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(17,24,39,0.62)",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 950,
              color: "rgba(17,24,39,0.60)",
              padding: 6,
              margin: -6,
              borderRadius: 10,
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>

        {footer && (
          <div
            style={{
              padding: 16,
              borderTop: "1px solid rgba(17,24,39,0.08)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   small UI bits
========================= */
function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: {
      border: "1px solid rgba(17,24,39,0.12)",
      bg: "rgba(17,24,39,0.06)",
      color: "rgba(17,24,39,0.78)",
    },
    brand: {
      border: "1px solid rgba(79,124,247,0.18)",
      bg: "rgba(79,124,247,0.10)",
      color: "rgba(17,24,39,0.92)",
    },
    success: {
      border: "1px solid rgba(31,157,106,0.18)",
      bg: "rgba(31,157,106,0.10)",
      color: "rgba(17,24,39,0.92)",
    },
    warning: {
      border: "1px solid rgba(245,197,66,0.22)",
      bg: "rgba(245,197,66,0.12)",
      color: "rgba(17,24,39,0.92)",
    },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
        ...t,
      }}
    >
      {children}
    </span>
  );
}

function Spinner({ size = 14 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.65)",
        borderTopColor: "rgba(255,255,255,1)",
        display: "inline-block",
        animation: "spin 0.9s linear infinite",
      }}
    />
  );
}

/* =========================
   main
========================= */
export default function OrganisationDashboard({ user, profile }) {
  const navigate = useNavigate();
  const width = useWindowWidth();

  const [organisations, setOrganisations] = useState([]);
  const [members, setMembers] = useState({});
  const [expanded, setExpanded] = useState({});

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [newOrgName, setNewOrgName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [search, setSearch] = useState("");

  // UX
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState("name_asc");
  const [pinVisible, setPinVisible] = useState({});
  const [showQuick, setShowQuick] = useState(false);

  // action states
  const [busy, setBusy] = useState({
    create: false,
    join: false,
    openFirst: false,
    deletingOrgId: null,
    leavingOrgId: null,
  });

  // confirm dialog
  const [confirm, setConfirm] = useState({
    open: false,
    title: "",
    subtitle: "",
    intent: "", // "delete" | "leave"
    org: null,
  });

  const showToast = (payload) => setToast(payload);

  const isMobile = width < 720;
  const oneCol = width < 980;

  const username = profile?.username || "User";

  // enterprise-style theme tokens (calmer, less playful)
  const t = {
    pageBg: "#f6f7fb",
    text: "#111827",
    muted: "#6b7280",
    surface: "rgba(255,255,255,0.96)",
    border: "rgba(17,24,39,0.14)",
    shadow: "0 18px 42px rgba(17,24,39,0.10)",

    primary: "#2f6fed",
    primary2: "#1f5fe2",
    danger: "#e25555",
    danger2: "#cf3f3f",
    success: "#1f9d6a",

    ring: "rgba(47,111,237,0.18)",
    inputBg: "rgba(255,255,255,0.98)",
    inputBorder: "rgba(17,24,39,0.16)",
  };

  // LOAD DATA
  const loadData = async () => {
    setPageError("");
    setLoading(true);

    try {
      const { data: orgs, error: orgErr } = await getMyOrganisations(user.id);
      if (orgErr) throw orgErr;

      const list = orgs || [];
      setOrganisations(list);

      const mems = {};
      for (let org of list) {
        const { data: m, error: memErr } = await getMembers(org.id);
        if (memErr) throw memErr;
        mems[org.id] = m || [];
      }
      setMembers(mems);
    } catch (err) {
      setPageError(safeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // SUBSCRIPTIONS
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("org-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organisation_members",
          filter: `user_id=eq.${user.id}`,
        },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || organisations.length === 0) return;

    const filterIds = organisations.map((o) => o.id).join(",");

    const channel = supabase
      .channel("member-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organisation_members",
          filter: `organisation_id=in.(${filterIds})`,
        },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisations, user]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const copyPin = async (pin) => {
    try {
      await navigator.clipboard.writeText(pin);
      showToast({
        tone: "success",
        icon: "📋",
        title: "Copied",
        message: "PIN copied to clipboard",
      });
    } catch {
      showToast({
        tone: "danger",
        icon: "⚠️",
        title: "Copy failed",
        message: "Clipboard permission blocked",
      });
    }
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const togglePin = (id) =>
    setPinVisible((prev) => ({ ...prev, [id]: !prev[id] }));

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = organisations.filter((o) =>
      o.name.toLowerCase().includes(q)
    );

    const withCounts = filtered.map((o) => ({
      ...o,
      _memberCount: (members[o.id] || []).length,
    }));

    if (sortBy === "name_asc")
      withCounts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name_desc")
      withCounts.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === "members_desc")
      withCounts.sort((a, b) => (b._memberCount || 0) - (a._memberCount || 0));

    return withCounts;
  }, [organisations, members, search, sortBy]);

  // focus ring for inputs
  const focusHandlers = (setter) => ({
    onFocus: (e) => {
      e.currentTarget.style.boxShadow = `0 0 0 4px ${t.ring}`;
      e.currentTarget.style.borderColor = "rgba(47,111,237,0.35)";
    },
    onBlur: (e) => {
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.borderColor = t.inputBorder;
    },
    onChange: (e) => setter(e.target.value),
  });

  const styles = {
    page: {
      minHeight: "100vh",
      width: "100%",
      position: "relative",
      padding: 22,
      color: t.text,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: "default",
    },
    bg: { position: "fixed", inset: 0, zIndex: -2, background: t.pageBg },
    bgGrid: {
      position: "fixed",
      inset: 0,
      zIndex: -1,
      backgroundImage:
        "linear-gradient(to right, rgba(17,24,39,0.04) 1px, transparent 1px)," +
        "linear-gradient(to bottom, rgba(17,24,39,0.04) 1px, transparent 1px)",
      backgroundSize: "64px 64px",
      opacity: 0.1,
      pointerEvents: "none",
    },

    container: { maxWidth: 1180, margin: "0 auto" },

    header: {
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
      marginBottom: 14,
    },

    breadcrumb: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      color: "rgba(17,24,39,0.58)",
      fontSize: 13,
      fontWeight: 850,
    },

    titleRow: {
      display: "flex",
      gap: 10,
      alignItems: "baseline",
      flexWrap: "wrap",
      marginTop: 6,
    },

    title: { margin: 0, fontSize: 32, fontWeight: 950, letterSpacing: "-0.5px" },

    subtitle: {
      margin: "6px 0 0",
      color: "rgba(17,24,39,0.62)",
      fontSize: 13,
      fontWeight: 800,
      maxWidth: 760,
    },

    welcome: {
      marginTop: 6,
      color: "rgba(17,24,39,0.78)",
      fontSize: 13,
      fontWeight: 900,
    },

    rightHeader: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },

    btn: {
      borderRadius: 12,
      padding: "10px 14px",
      cursor: "pointer",
      fontWeight: 950,
      border: `1px solid ${t.border}`,
      background: "rgba(255,255,255,0.90)",
      color: "rgba(17,24,39,0.86)",
      boxShadow: "0 10px 22px rgba(17,24,39,0.06)",
    },

    btnPrimary: {
      border: "none",
      background: `linear-gradient(90deg, ${t.primary}, ${t.primary2})`,
      color: "#fff",
      boxShadow: "0 14px 30px rgba(47,111,237,0.18)",
    },

    btnDanger: {
      border: "none",
      background: `linear-gradient(90deg, ${t.danger}, ${t.danger2})`,
      color: "#fff",
      boxShadow: "0 14px 30px rgba(226, 61, 61, 0.18)",
    },

    avatarBtn: {
      width: 42,
      height: 42,
      borderRadius: 999,
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      color: "#fff",
      background: `linear-gradient(135deg, ${t.primary}, ${t.primary2})`,
      boxShadow: "0 12px 24px rgba(47,111,237,0.18)",
      border: "none",
      cursor: "pointer",
      transition: "0.15s",
    },

    panelGrid: {
      display: "grid",
      gridTemplateColumns: oneCol ? "1fr" : "1fr 1fr",
      gap: 14,
      marginTop: 10,
      marginBottom: 16,
    },

    panel: {
      borderRadius: 16,
      border: `1px solid ${t.border}`,
      background: t.surface,
      boxShadow: t.shadow,
      padding: 16,
    },

    panelHeader: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 10,
    },

    sectionH2: { margin: 0, fontSize: 15, fontWeight: 950 },
    helper: { color: "rgba(17,24,39,0.62)", fontSize: 12, fontWeight: 850 },

    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      outline: "none",
      fontSize: 14,
      color: t.text,
      transition: "0.15s",
    },

    formGridCreate: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "center",
    },

    formGridJoin: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 160px auto",
      gap: 10,
      alignItems: "center",
    },

    toolRow: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 220px",
      gap: 12,
      alignItems: "center",
      marginTop: 14,
      marginBottom: 14,
    },

    searchWrap: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid ${t.border}`,
      background: t.surface,
      boxShadow: "0 10px 22px rgba(17,24,39,0.06)",
    },

    searchInput: {
      flex: 1,
      border: "none",
      outline: "none",
      background: "transparent",
      fontSize: 14,
      color: t.text,
    },

    sort: {
      border: `1px solid ${t.border}`,
      background: t.surface,
      borderRadius: 12,
      padding: "11px 12px",
      outline: "none",
      fontWeight: 900,
      color: t.text,
      boxShadow: "0 10px 22px rgba(17,24,39,0.06)",
      cursor: "pointer",
    },

    workspacesHeader: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 4,
      marginBottom: 10,
    },

    workspacesTitle: { margin: 0, fontSize: 15, fontWeight: 950 },

    countPill: {
      fontSize: 12,
      fontWeight: 950,
      padding: "7px 10px",
      borderRadius: 999,
      border: "1px solid rgba(47,111,237,0.18)",
      background: "rgba(47,111,237,0.10)",
      color: "rgba(17,24,39,0.92)",
      whiteSpace: "nowrap",
    },

    grid: {
      display: "grid",
      gridTemplateColumns: oneCol ? "1fr" : "repeat(2, minmax(0, 1fr))",
      gap: 14,
    },

    card: {
      borderRadius: 16,
      padding: 16,
      border: `1px solid ${t.border}`,
      background: t.surface,
      boxShadow: t.shadow,
      transition: "0.18s",
    },

    cardTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },

    cardTitle: { margin: 0, fontSize: 16, fontWeight: 950 },

    badges: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },

    pinRow: {
      marginTop: 12,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(17,24,39,0.10)",
      background: "rgba(17,24,39,0.03)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },

    pinLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      fontSize: 13,
      fontWeight: 900,
      color: "rgba(17,24,39,0.76)",
    },

    tinyBtn: {
      border: `1px solid rgba(17,24,39,0.14)`,
      background: "rgba(255,255,255,0.92)",
      borderRadius: 12,
      padding: "8px 10px",
      cursor: "pointer",
      fontWeight: 950,
      color: "rgba(17,24,39,0.86)",
      transition: "0.15s",
      whiteSpace: "nowrap",
    },

    actions: {
      marginTop: 12,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },

    expandBtn: {
      marginTop: 10,
      border: "none",
      background: "transparent",
      color: t.primary,
      cursor: "pointer",
      fontWeight: 950,
      padding: "6px 0",
      textAlign: "left",
    },

    members: {
      marginTop: 10,
      borderLeft: "3px solid rgba(47,111,237,0.22)",
      paddingLeft: 12,
      display: "grid",
      gap: 6,
      color: "rgba(17,24,39,0.72)",
      fontSize: 13,
      fontWeight: 850,
    },

    memberItem: { display: "flex", justifyContent: "space-between", gap: 10 },

    empty: {
      borderRadius: 16,
      border: `1px dashed rgba(47,111,237,0.24)`,
      background: "rgba(255,255,255,0.88)",
      padding: 18,
      color: "rgba(17,24,39,0.74)",
      boxShadow: "0 14px 34px rgba(17,24,39,0.08)",
    },

    errorBox: {
      borderRadius: 16,
      border: "1px solid rgba(226,61,61,0.22)",
      background: "rgba(226,61,61,0.08)",
      padding: 14,
      color: "rgba(17,24,39,0.90)",
      fontWeight: 850,
      fontSize: 13,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 10,
      marginBottom: 10,
    },

    loading: {
      minHeight: "60vh",
      display: "grid",
      placeItems: "center",
      color: t.muted,
      fontWeight: 950,
    },
  };

  const cardHover = {
    transform: "translateY(-1px)",
    boxShadow: "0 26px 60px rgba(17,24,39,0.12)",
    border: "1px solid rgba(47,111,237,0.20)",
  };

  const openConfirm = (intent, org) => {
    if (!org) return;
    if (intent === "delete") {
      setConfirm({
        open: true,
        title: "Delete workspace?",
        subtitle: `This will permanently remove “${org.name}”. Members will lose access.`,
        intent,
        org,
      });
    } else {
      setConfirm({
        open: true,
        title: "Leave workspace?",
        subtitle: `You will lose access to “${org.name}” until you re-join.`,
        intent,
        org,
      });
    }
  };

  const runConfirm = async () => {
    const org = confirm.org;
    const intent = confirm.intent;
    if (!org) return;

    try {
      if (intent === "delete") {
        setBusy((b) => ({ ...b, deletingOrgId: org.id }));
        await deleteOrganisation(org.id, user.id);
        await loadData();
        showToast({
          tone: "success",
          icon: "🗑️",
          title: "Deleted",
          message: "Workspace removed",
        });
      } else {
        setBusy((b) => ({ ...b, leavingOrgId: org.id }));
        await leaveOrganisation(org.id, user.id);
        await loadData();
        showToast({
          tone: "info",
          icon: "🚪",
          title: "Left workspace",
          message: "You left the workspace",
        });
      }
    } catch (err) {
      showToast({
        tone: "danger",
        icon: "⚠️",
        title: "Action failed",
        message: safeErrorMessage(err),
      });
    } finally {
      setBusy((b) => ({ ...b, deletingOrgId: null, leavingOrgId: null }));
      setConfirm({ open: false, title: "", subtitle: "", intent: "", org: null });
    }
  };

  if (loading) return <div style={styles.loading}>Loading workspaces…</div>;

  return (
    <main style={styles.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={styles.bg} aria-hidden="true" />
      <div style={styles.bgGrid} aria-hidden="true" />

      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Quick actions */}
      <Modal
        open={showQuick}
        title="Quick actions"
        subtitle="Fast shortcuts for your workspace dashboard."
        onClose={() => setShowQuick(false)}
        footer={
          <button style={styles.btn} onClick={() => setShowQuick(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <button
            style={{
              ...styles.btn,
              ...styles.btnPrimary,
              width: "100%",
              display: "flex",
              gap: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
            onClick={() => {
              setSearch("");
              setSortBy("name_asc");
              showToast({
                tone: "success",
                icon: "🧼",
                title: "Reset",
                message: "Search + sort reset",
              });
              setShowQuick(false);
            }}
          >
            Reset search + sort
          </button>

          <button
            style={{ ...styles.btn, width: "100%" }}
            disabled={busy.openFirst}
            onClick={async () => {
              const first = organisations?.[0];
              if (!first) {
                showToast({
                  tone: "info",
                  icon: "ℹ️",
                  title: "No workspaces",
                  message: "Create or join one first",
                });
                return;
              }
              try {
                setBusy((b) => ({ ...b, openFirst: true }));
                await sleep(150);
                localStorage.setItem("activeOrgId", first.id);
                navigate(`/org/${first.id}/workitems`);
              } finally {
                setBusy((b) => ({ ...b, openFirst: false }));
              }
            }}
          >
            {busy.openFirst ? "Opening…" : "Open first workspace"}
          </button>

          <button
            style={{ ...styles.btn, ...styles.btnDanger, width: "100%" }}
            onClick={() => {
              setShowQuick(false);
              logout();
            }}
          >
            Logout
          </button>
        </div>
      </Modal>

      {/* Confirm */}
      <Modal
        open={confirm.open}
        title={confirm.title}
        subtitle={confirm.subtitle}
        onClose={() =>
          setConfirm({ open: false, title: "", subtitle: "", intent: "", org: null })
        }
        footer={
          <>
            <button
              style={styles.btn}
              onClick={() =>
                setConfirm({ open: false, title: "", subtitle: "", intent: "", org: null })
              }
            >
              Cancel
            </button>
            <button
              style={{
                ...styles.btn,
                ...(confirm.intent === "delete" ? styles.btnDanger : styles.btnPrimary),
              }}
              onClick={runConfirm}
              disabled={
                (confirm.intent === "delete" &&
                  busy.deletingOrgId === confirm.org?.id) ||
                (confirm.intent === "leave" &&
                  busy.leavingOrgId === confirm.org?.id)
              }
            >
              {confirm.intent === "delete"
                ? busy.deletingOrgId === confirm.org?.id
                  ? "Deleting…"
                  : "Delete"
                : busy.leavingOrgId === confirm.org?.id
                ? "Leaving…"
                : "Leave"}
            </button>
          </>
        }
      >
        <div
          style={{
            color: "rgba(17,24,39,0.75)",
            fontSize: 13,
            fontWeight: 850,
            lineHeight: 1.4,
          }}
        >
          {confirm.intent === "delete" ? (
            <>
              This action is <strong>permanent</strong>. If you want to keep it,
              cancel and remove members instead.
            </>
          ) : (
            <>You can re-join later using the workspace name + PIN.</>
          )}
        </div>
      </Modal>

      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              <span>Account</span>
              <span style={{ opacity: 0.55 }}>›</span>
              <span style={{ color: "rgba(17,24,39,0.78)" }}>Workspaces</span>
            </div>

            <div style={styles.titleRow}>
              <h1 style={styles.title}>Workspaces</h1>
              <Pill tone="brand">KIRO</Pill>
            </div>

            <p style={styles.subtitle}>
              Create or join a workspace. Open one to manage shared backlog and tasks.
            </p>

            <div style={styles.welcome}>Welcome, {username}</div>
          </div>

          <div style={styles.rightHeader}>
            <button style={styles.btn} onClick={() => setShowQuick(true)}>
              ⚡ Quick actions
            </button>

            <button style={styles.btn} onClick={() => navigate("/kanban")}>
              Go to Kanban
            </button>

            <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={logout}>
              Logout
            </button>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              title="Open Profile"
              aria-label="Open Profile"
              style={styles.avatarBtn}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              {username.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {/* Error banner */}
        {pageError && (
          <div style={styles.errorBox}>
            <div>
              <div style={{ fontWeight: 950, marginBottom: 4 }}>Couldn’t load data</div>
              <div style={{ opacity: 0.9 }}>{pageError}</div>
            </div>
            <button
              style={{ ...styles.btn, background: "rgba(255,255,255,0.85)" }}
              onClick={loadData}
            >
              Retry
            </button>
          </div>
        )}

        {/* CREATE + JOIN */}
        <div style={styles.panelGrid}>
          <section style={styles.panel} aria-label="Create workspace">
            <div style={styles.panelHeader}>
              <h2 style={styles.sectionH2}>Create workspace</h2>
              <div style={styles.helper}>A PIN is generated for secure invites</div>
            </div>

            <div style={styles.formGridCreate}>
              <input
                style={styles.input}
                placeholder="Workspace name"
                value={newOrgName}
                {...focusHandlers(setNewOrgName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") document.getElementById("createOrgBtn")?.click();
                }}
              />

              <button
                id="createOrgBtn"
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={busy.create}
                onClick={async () => {
                  if (!newOrgName.trim()) {
                    showToast({
                      tone: "danger",
                      icon: "⚠️",
                      title: "Missing name",
                      message: "Enter a workspace name",
                    });
                    return;
                  }
                  try {
                    setBusy((b) => ({ ...b, create: true }));
                    const { data, error } = await createOrganisation(newOrgName, user.id);
                    if (error) throw error;
                    setNewOrgName("");
                    await loadData();
                    showToast({
                      tone: "success",
                      icon: "✅",
                      title: "Created",
                      message: `PIN: ${data.pin}`,
                    });
                  } catch (err) {
                    showToast({
                      tone: "danger",
                      icon: "⚠️",
                      title: "Create failed",
                      message: safeErrorMessage(err),
                    });
                  } finally {
                    setBusy((b) => ({ ...b, create: false }));
                  }
                }}
              >
                {busy.create ? (
                  <>
                    <Spinner /> Creating…
                  </>
                ) : (
                  "+ Create"
                )}
              </button>
            </div>
          </section>

          <section style={styles.panel} aria-label="Join workspace">
            <div style={styles.panelHeader}>
              <h2 style={styles.sectionH2}>Join workspace</h2>
              <div style={styles.helper}>Use workspace name + PIN</div>
            </div>

            <div style={styles.formGridJoin}>
              <input
                style={styles.input}
                placeholder="Workspace name"
                value={joinName}
                {...focusHandlers(setJoinName)}
              />
              <input
                style={styles.input}
                placeholder="PIN"
                value={joinPin}
                {...focusHandlers(setJoinPin)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") document.getElementById("joinOrgBtn")?.click();
                }}
              />
              <button
                id="joinOrgBtn"
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={busy.join}
                onClick={async () => {
                  if (!joinName.trim() || !joinPin.trim()) {
                    showToast({
                      tone: "danger",
                      icon: "⚠️",
                      title: "Missing fields",
                      message: "Enter workspace name and PIN",
                    });
                    return;
                  }
                  try {
                    setBusy((b) => ({ ...b, join: true }));
                    const { error } = await joinOrganisation(joinName, joinPin, user.id);
                    if (error) throw error;
                    setJoinName("");
                    setJoinPin("");
                    await loadData();
                    showToast({
                      tone: "success",
                      icon: "🎉",
                      title: "Joined",
                      message: "Access granted",
                    });
                  } catch (err) {
                    showToast({
                      tone: "danger",
                      icon: "⚠️",
                      title: "Join failed",
                      message: safeErrorMessage(err),
                    });
                  } finally {
                    setBusy((b) => ({ ...b, join: false }));
                  }
                }}
              >
                {busy.join ? (
                  <>
                    <Spinner /> Joining…
                  </>
                ) : (
                  "Join"
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Search + sort */}
        <div style={styles.toolRow}>
          <div style={styles.searchWrap}>
            <span style={{ opacity: 0.7 }}>🔍</span>
            <input
              style={styles.searchInput}
              placeholder="Search workspaces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search workspaces"
            />
          </div>

          <select
            style={styles.sort}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort workspaces"
          >
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="name_desc">Sort: Name (Z → A)</option>
            <option value="members_desc">Sort: Most members</option>
          </select>
        </div>

        {/* Workspaces */}
        <div style={styles.workspacesHeader}>
          <h2 style={styles.workspacesTitle}>Your workspaces</h2>
          <div style={styles.countPill}>{filteredAndSorted.length} workspace(s)</div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>No workspaces found</div>
            <div>Try a different search, or create / join a workspace above.</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredAndSorted.map((org) => {
              const orgMembers = members[org.id] || [];
              const isOwner = org.owner_id === user.id;

              const isDeleting = busy.deletingOrgId === org.id;
              const isLeaving = busy.leavingOrgId === org.id;

              return (
                <HoverCard key={org.id} baseStyle={styles.card} hoverStyle={cardHover}>
                  <div style={styles.cardTop}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <h3 style={styles.cardTitle}>{org.name}</h3>
                      <div style={styles.badges}>
                        <Pill tone={isOwner ? "brand" : "neutral"}>
                          {isOwner ? "Owner" : "Member"}
                        </Pill>
                        <Pill tone="neutral">👥 {orgMembers.length} members</Pill>
                      </div>
                    </div>

                    <button
                      style={{ ...styles.btn, ...styles.btnPrimary, padding: "9px 12px" }}
                      onClick={() => {
                        localStorage.setItem("activeOrgId", org.id);
                        navigate(`/org/${org.id}/workitems`);
                      }}
                    >
                      Open →
                    </button>
                  </div>

                  <div style={styles.pinRow}>
                    <div style={styles.pinLeft}>
                      <span>
                        PIN:{" "}
                        <strong style={{ color: "rgba(17,24,39,0.92)" }}>
                          {pinVisible[org.id] ? org.pin : "••••••"}
                        </strong>
                      </span>

                      <button style={styles.tinyBtn} onClick={() => togglePin(org.id)}>
                        {pinVisible[org.id] ? "Hide" : "Show"}
                      </button>
                    </div>

                    <button style={styles.tinyBtn} onClick={() => copyPin(org.pin)}>
                      📋 Copy
                    </button>
                  </div>

                  <div style={styles.actions}>
                    <button
                      style={{ ...styles.btn, ...styles.btnPrimary, padding: "10px 14px" }}
                      onClick={() => {
                        localStorage.setItem("activeOrgId", org.id);
                        navigate(`/org/${org.id}/workitems`);
                      }}
                    >
                      Open backlog
                    </button>

                    <button
                      style={styles.btn}
                      onClick={() => {
                        setPinVisible((p) => ({ ...p, [org.id]: true }));
                        copyPin(org.pin);
                      }}
                    >
                      Copy + show PIN
                    </button>

                    {isOwner ? (
                      <button
                        style={{
                          ...styles.btn,
                          background: "rgba(226,61,61,0.10)",
                          borderColor: "rgba(226,61,61,0.18)",
                          color: "rgba(207,63,63,1)",
                        }}
                        disabled={isDeleting}
                        onClick={() => openConfirm("delete", org)}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    ) : (
                      <button
                        style={{
                          ...styles.btn,
                          background: "rgba(226,61,61,0.10)",
                          borderColor: "rgba(226,61,61,0.18)",
                          color: "rgba(207,63,63,1)",
                        }}
                        disabled={isLeaving}
                        onClick={() => openConfirm("leave", org)}
                      >
                        {isLeaving ? "Leaving…" : "Leave"}
                      </button>
                    )}
                  </div>

                  <button onClick={() => toggleExpand(org.id)} style={styles.expandBtn}>
                    {expanded[org.id] ? "Hide members ▲" : "View members ▼"}
                  </button>

                  {/* ✅ UPDATED MEMBERS LIST (FIXES "User" ISSUE) */}
                  {expanded[org.id] && (
                    <div style={styles.members}>
                      {orgMembers.map((m) => {
                        const displayName = (m.username || "").trim() || "User";
                        const isOwnerRow = m.role === "owner" || m.user_id === org.owner_id;

                        return (
                          <div key={m.user_id} style={styles.memberItem}>
                            <span style={{ color: "rgba(17,24,39,0.92)", fontWeight: 900 }}>
                              {displayName}
                            </span>
                            <span style={{ opacity: 0.85 }}>
                              {isOwnerRow ? "(Owner)" : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </HoverCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* hover helper */
function HoverCard({ children, baseStyle, hoverStyle }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ ...baseStyle, ...(hover ? hoverStyle : {}) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </div>
  );
}
