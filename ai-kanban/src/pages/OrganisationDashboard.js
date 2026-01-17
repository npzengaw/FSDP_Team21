import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

import {
  getMyOrganisations,
  getMembers,
  createOrganisation,
  joinOrganisation,
  leaveOrganisation,
  deleteOrganisation,
} from "../organisation";

export default function OrganisationDashboard({ user, profile }) {
  const navigate = useNavigate();

  const [organisations, setOrganisations] = useState([]);
  const [members, setMembers] = useState({});
  const [expanded, setExpanded] = useState({});
  const [hovered, setHovered] = useState(null);

  const [loading, setLoading] = useState(true);
  const [newOrgName, setNewOrgName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [search, setSearch] = useState("");

  // THEME (light/dark)
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("dashboardTheme");
    if (stored) setTheme(stored);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("dashboardTheme", next);
  };

  // select correct styles
  const styles = theme === "light" ? lightStyles : darkStyles;

  // LOAD DATA
  const loadData = async () => {
    const { data: orgs } = await getMyOrganisations(user.id);
    setOrganisations(orgs || []);

    const mems = {};
    for (let org of orgs || []) {
      const { data: m } = await getMembers(org.id);
      mems[org.id] = m || [];
    }
    setMembers(mems);

    setLoading(false);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // SUBSCRIPTIONS
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("org-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "organisation_members", filter: `user_id=eq.${user.id}` },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
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
  }, [organisations]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const copyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    alert("PIN copied!");
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <p style={{ padding: 40 }}>Loading...</p>;

  const filtered = organisations.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.page}>
      {/* TOP RIGHT NAV BAR */}
      <div style={styles.topRight}>
        <button onClick={toggleTheme} style={styles.themeToggle}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        <button onClick={logout} style={styles.logoutBtn}>
          Logout
        </button>

        <div style={styles.avatar}></div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.container}>
        <h1 style={styles.title}>
          Welcome, <span style={styles.titleAccent}>{profile?.username}</span>
        </h1>

        {/* SEARCH */}
        <div style={styles.searchBox}>
          <span style={{ marginRight: 10, opacity: 0.7 }}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* CREATE ORG */}
        <h2 style={styles.sectionHeader}>Create Organisation</h2>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Organisation Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
          />
          <button
            style={styles.primaryBtn}
            onClick={async () => {
              if (!newOrgName.trim()) return alert("Enter name");
              const { data, error } = await createOrganisation(newOrgName, user.id);
              if (error) return alert(error.message);
              alert(`Created! PIN: ${data.pin}`);
              setNewOrgName("");
              loadData();
            }}
          >
            + Create
          </button>
        </div>

        {/* JOIN ORG */}
        <h2 style={styles.sectionHeader}>Join Organisation</h2>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Organisation Name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
          />
          <input
            style={{ ...styles.input, width: "130px" }}
            placeholder="PIN"
            value={joinPin}
            onChange={(e) => setJoinPin(e.target.value)}
          />
          <button
            style={styles.primaryBtn}
            onClick={async () => {
              if (!joinName.trim() || !joinPin.trim()) return alert("Fill all fields");
              const { error } = await joinOrganisation(joinName, joinPin, user.id);
              if (error) return alert(error.message);
              alert("Joined!");
              setJoinName("");
              setJoinPin("");
              loadData();
            }}
          >
            Join
          </button>
        </div>

        {/* WORKSPACES */}
        <h2 style={styles.sectionHeader}>Your Workspaces</h2>

        {filtered.map((org) => {
          const orgMembers = members[org.id] || [];
          const isOwner = org.owner_id === user.id;

          return (
            <div
              key={org.id}
              style={{
                ...styles.card,
                ...(hovered === org.id ? styles.cardHover : {}),
              }}
              onMouseEnter={() => setHovered(org.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* CARD TOP */}
              <div style={styles.cardTop}>
                <h3 style={styles.cardTitle}>{org.name}</h3>

                <div style={styles.badgeRow}>
                  <div style={isOwner ? styles.ownerBadge : styles.memberBadge}>
                    {isOwner ? "Owner" : "Member"}
                  </div>

                  <div style={styles.memberCount}>👥 {orgMembers.length}</div>
                </div>
              </div>

              {/* PIN */}
              <div style={styles.pinRow}>
                <span style={{ opacity: 0.8 }}>PIN: {org.pin}</span>
                <button style={styles.copyBtn} onClick={() => copyPin(org.pin)}>
                  📋 Copy
                </button>
              </div>

              {/* BUTTONS */}
              <div style={styles.buttonRow}>
                <button
                  style={styles.secondaryBtn}
                    onClick={() => {
                      localStorage.setItem("activeOrgId", org.id);
                      navigate(`/org/${org.id}/workitems`);
                    }}
                >
                  Open →
                </button>

                {isOwner ? (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => {
                      if (!window.confirm("Delete organisation?")) return;
                      deleteOrganisation(org.id, user.id).then(loadData);
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    style={styles.leaveBtn}
                    onClick={() =>
                      leaveOrganisation(org.id, user.id).then(loadData)
                    }
                  >
                    Leave
                  </button>
                )}
              </div>

              {/* MEMBERS */}
              <button
                onClick={() => toggleExpand(org.id)}
                style={styles.expandBtn}
              >
                {expanded[org.id] ? "Hide Members ▲" : "View Members ▼"}
              </button>

              {expanded[org.id] && (
                <div style={styles.memberList}>
                  {orgMembers.map((m) => (
                    <div key={m.user_id} style={styles.memberItem}>
                      {m.username || "User"}{" "}
                      {m.user_id === org.owner_id ? "(Owner)" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================
   LIGHT THEME STYLES
   ========================================================== */

const lightStyles = {
  page: {
    minHeight: "100vh",
    paddingLeft: 40,
    paddingTop: 40,
    paddingRight: 40,
    fontFamily: "Inter, sans-serif",
    color: "#1A1A1A",
    background:
      "radial-gradient(circle at 20% 20%, rgba(140,107,255,0.2), transparent 60%)," +
      "radial-gradient(circle at 80% 80%, rgba(120,180,255,0.18), transparent 55%)," +
      "#F8F8FF",
    transition: "background 0.3s ease, color 0.3s ease",

    userSelect: "none", // FIX for annoying text cursor
    cursor: "default",
  },

  topRight: {
    position: "absolute",
    top: 20,
    right: 25,
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  themeToggle: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.9)",
    border: "none",
    cursor: "pointer",
    fontSize: "1.1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
    transition: "0.2s",
  },

  logoutBtn: {
    background: "#e65b5b",
    color: "white",
    padding: "9px 18px",
    borderRadius: "10px",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },

  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7a5cff, #a48eff)",
    boxShadow: "0 8px 20px rgba(122,92,255,0.3)",
  },

  container: {
    maxWidth: "760px",
  },

  title: {
    fontSize: "2.4rem",
    fontWeight: 800,
    marginBottom: "1.6rem",
  },

  titleAccent: {
    color: "#7a5cff",
  },

  searchBox: {
    background: "rgba(255,255,255,0.95)",
    display: "flex",
    alignItems: "center",
    padding: "14px 18px",
    borderRadius: "12px",
    border: "1px solid #e2e2f0",
    marginBottom: "2.2rem",
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },

  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "1rem",
    color: "#333",
  },

  sectionHeader: {
    fontSize: "1.4rem",
    fontWeight: 700,
    marginBottom: "0.8rem",
    marginTop: "1.5rem",
  },

  row: {
    display: "flex",
    gap: 12,
    marginBottom: "1.6rem",
  },

  input: {
    flex: 1,
    background: "white",
    borderRadius: "10px",
    border: "1px solid #ccc",
    padding: "12px 14px",
    fontSize: "1rem",
    color: "#333",
    boxShadow: "0 3px 8px rgba(0,0,0,0.05)",
  },

  primaryBtn: {
    background: "linear-gradient(135deg, #7a5cff, #8d6dff)",
    border: "none",
    padding: "12px 20px",
    borderRadius: "10px",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(122,92,255,0.35)",
  },

  card: {
    background: "rgba(255,255,255,0.98)",
    border: "1px solid #e5e5f0",
    padding: "1.8rem 2rem",
    borderRadius: "20px",
    marginBottom: "1.8rem",
    transition: "0.25s ease",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },

  cardHover: {
    boxShadow: "0 14px 32px rgba(122,92,255,0.25)",
    border: "1px solid #c7bcff",
    transform: "translateY(-3px)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },

  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "1.35rem",
    fontWeight: 800,
    color: "#222",
  },

  ownerBadge: {
    background: "#efe9ff",
    padding: "4px 12px",
    borderRadius: "20px",
    border: "1px solid #7a5cff",
    fontSize: "0.8rem",
    color: "#6a52f4",
  },

  memberBadge: {
    background: "#f3f3f7",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    color: "#444",
  },

  memberCount: {
    background: "#f4f0ff",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    color: "#7a5cff",
  },

  pinRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "1rem",
    color: "#444",
  },

  copyBtn: {
    padding: "5px 12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    background: "#fafafa",
    cursor: "pointer",
  },

  buttonRow: {
    display: "flex",
    gap: 14,
    marginTop: 20,
  },

  secondaryBtn: {
    background: "#f5f3ff",
    border: "1px solid #c8c1ff",
    padding: "10px 20px",
    borderRadius: "10px",
    color: "#6a52f4",
    fontWeight: 600,
    cursor: "pointer",
  },

  leaveBtn: {
    background: "#ffb3b3",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "#7a1e1e",
    fontWeight: 600,
  },

  deleteBtn: {
    background: "#ff8c8c",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: 600,
  },

  expandBtn: {
    marginTop: 14,
    background: "none",
    border: "none",
    color: "#7a5cff",
    cursor: "pointer",
    fontWeight: 600,
  },

  memberList: {
    marginTop: 12,
    paddingLeft: 15,
    borderLeft: "3px solid #ddd",
  },

  memberItem: {
    padding: "5px 0",
    fontSize: "0.95rem",
    color: "#555",
  },
};

/* ==========================================================
   DARK THEME STYLES
   ========================================================== */

const darkStyles = {
  page: {
    minHeight: "100vh",
    paddingLeft: 40,
    paddingTop: 40,
    paddingRight: 40,
    fontFamily: "Inter, sans-serif",
    color: "#F7F7FF",
    background:
      "radial-gradient(circle at 20% 20%, rgba(120,90,255,0.25), transparent 60%)," +
      "radial-gradient(circle at 80% 80%, rgba(80,120,255,0.18), transparent 55%)," +
      "#0c0c12",
    transition: "background 0.3s ease, color 0.3s ease",

    userSelect: "none", // FIX cursor issue
    cursor: "default",
  },

  topRight: {
    position: "absolute",
    top: 20,
    right: 25,
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  themeToggle: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "rgba(25,25,35,0.9)",
    border: "1px solid #3c3c57",
    cursor: "pointer",
    fontSize: "1.1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
  },

  logoutBtn: {
    background: "#c94f4f",
    color: "white",
    padding: "9px 18px",
    borderRadius: "10px",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
  },

  avatar: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #7a5cff, #b09bff)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
  },

  container: {
    maxWidth: "760px",
  },

  title: {
    fontSize: "2.4rem",
    fontWeight: 800,
    marginBottom: "1.6rem",
  },

  titleAccent: {
    color: "#b6a4ff",
  },

  searchBox: {
    background: "rgba(20,20,26,0.96)",
    display: "flex",
    alignItems: "center",
    padding: "14px 18px",
    borderRadius: "12px",
    border: "1px solid #323246",
    marginBottom: "2.2rem",
  },

  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "1rem",
    color: "#f0f0ff",
  },

  sectionHeader: {
    fontSize: "1.4rem",
    fontWeight: 700,
    marginBottom: "0.8rem",
    marginTop: "1.5rem",
  },

  row: {
    display: "flex",
    gap: 12,
    marginBottom: "1.6rem",
  },

  input: {
    flex: 1,
    background: "#181820",
    borderRadius: "10px",
    border: "1px solid #313146",
    padding: "12px 14px",
    fontSize: "1rem",
    color: "#f0f0ff",
  },

  primaryBtn: {
    background: "linear-gradient(135deg, #7a5cff, #9b80ff)",
    border: "none",
    padding: "12px 20px",
    borderRadius: "10px",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
  },

  card: {
    background: "rgba(18,18,26,0.98)",
    border: "1px solid #2b2b3f",
    padding: "1.8rem 2rem",
    borderRadius: "20px",
    marginBottom: "1.8rem",
    transition: "0.25s ease",
    boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
  },

  cardHover: {
    boxShadow: "0 16px 40px rgba(80,60,200,0.6)",
    border: "1px solid #6350ff",
    transform: "translateY(-3px)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },

  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "1.35rem",
    fontWeight: 800,
    color: "#ffffff",
  },

  ownerBadge: {
    background: "#2c2552",
    padding: "4px 12px",
    borderRadius: "20px",
    border: "1px solid #8f7dff",
    fontSize: "0.8rem",
    color: "#d5cffb",
  },

  memberBadge: {
    background: "#252533",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    color: "#ddddf8",
  },

  memberCount: {
    background: "#292544",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    color: "#d3caff",
  },

  pinRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "1rem",
    color: "#ddddf5",
  },

  copyBtn: {
    padding: "5px 12px",
    borderRadius: "8px",
    border: "1px solid #3c3c57",
    background: "#221f33",
    cursor: "pointer",
    color: "#f4f4ff",
  },

  buttonRow: {
    display: "flex",
    gap: 14,
    marginTop: 20,
  },

  secondaryBtn: {
    background: "#26233d",
    border: "1px solid #4a4580",
    padding: "10px 20px",
    borderRadius: "10px",
    color: "#d3caff",
    fontWeight: 600,
    cursor: "pointer",
  },

  leaveBtn: {
    background: "#a64848",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: 600,
  },

  deleteBtn: {
    background: "#c03c3c",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: "white",
    fontWeight: 600,
  },

  expandBtn: {
    marginTop: 14,
    background: "none",
    border: "none",
    color: "#c5b7ff",
    cursor: "pointer",
    fontWeight: 600,
  },

  memberList: {
    marginTop: 12,
    paddingLeft: 15,
    borderLeft: "3px solid #34344a",
  },

  memberItem: {
    padding: "5px 0",
    fontSize: "0.95rem",
    color: "#e0e0ff",
  },
};
