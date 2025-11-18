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

  const displayName = profile?.username || "User";
  const [organisations, setOrganisations] = useState([]);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);

  const [newOrgName, setNewOrgName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [search, setSearch] = useState("");

  // LOAD DATA
  const loadData = async () => {
    const { data: orgs } = await getMyOrganisations(user.id);
    setOrganisations(orgs || []);

    const mems = {};
    for (let org of orgs || []) {
      const { data: orgMembers } = await getMembers(org.id);
      mems[org.id] = orgMembers || [];
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

  // ACTIONS
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return alert("Enter a name");

    const { data, error } = await createOrganisation(newOrgName, user.id);
    if (error) return alert(error.message);

    alert(`Created org! PIN: ${data.pin}`);
    setNewOrgName("");
    loadData();
  };

  const handleJoinOrg = async () => {
    if (!joinName.trim() || !joinPin.trim()) return alert("Enter all fields");

    const { error } = await joinOrganisation(joinName, joinPin, user.id);
    if (error) return alert(error.message);

    alert("Joined!");
    setJoinName("");
    setJoinPin("");
    loadData();
  };

  const handleLeave = async (orgId) => {
    const { error } = await leaveOrganisation(orgId, user.id);
    if (error) return alert(error.message);
    loadData();
  };

  const handleDeleteOrg = async (orgId) => {
    if (!window.confirm("Delete this organisation?")) return;

    const { error } = await deleteOrganisation(orgId, user.id);
    if (error) return alert(error.message);

    loadData();
  };

  if (loading) return <p>Loading...</p>;

  // FILTER WORKSPACES
  const filtered = organisations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <button onClick={handleLogout} style={styles.logoutBtn}>
        Logout
      </button>

      <div style={styles.profile}></div>

      <h1 style={styles.title}>
        Welcome, <span style={{ color: "#695CEB" }}>{profile?.username}</span>
      </h1>

      {/* SEARCH BAR */}
      <div style={styles.searchContainer}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            placeholder="Search for a workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <button style={styles.filterBtn}>⏳</button>
      </div>

      {/* CREATE */}
      <div style={{ marginTop: "2rem" }}>
        <h2>Create Organisation</h2>
        <input
          style={styles.input}
          placeholder="Organisation Name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
        />
        <button style={styles.primaryBtn} onClick={handleCreateOrg}>
          Create
        </button>
      </div>

      {/* JOIN */}
      <h2 style={styles.sectionHeader}>Join Organisation</h2>
      <div style={styles.row}>
        <input
          style={styles.input}
          placeholder="Organisation Name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />
        <input
          style={{ ...styles.input, width: "120px" }}
          placeholder="PIN"
          value={joinPin}
          onChange={(e) => setJoinPin(e.target.value)}
        />
        <button style={styles.primaryBtn} onClick={handleJoinOrg}>
          Join
        </button>
      </div>

      {/* WORKSPACES */}
      <h2 style={styles.sectionHeader}>Your Workspaces</h2>

      {filtered.map((org) => (
        <div key={org.id} style={styles.card}>
          <div style={styles.cardLeft}>
            <h3 style={styles.cardTitle}>{org.name}</h3>

            <p style={styles.pin}>
              <strong>PIN:</strong> {org.pin}
            </p>

            <div style={styles.buttonRow}>
              <button
                style={styles.primaryBtn}
                onClick={() => navigate(`/org/${org.id}`)}
              >
                Open Board →
              </button>

              {org.owner_id !== user.id && (
                <button
                  onClick={() => handleLeave(org.id)}
                  style={{
                    marginLeft: "10px",
                    background: "#d9534f",
                    color: "white",
                    padding: "6px 10px",
                    borderRadius: "4px",
                  }}
                >
                  Leave
                </button>
              )}

              {org.owner_id === user.id && (
                <button
                  onClick={() => handleDeleteOrg(org.id)}
                  style={{
                    marginLeft: "10px",
                    background: "#b30000",
                    color: "white",
                    padding: "6px 10px",
                    borderRadius: "4px",
                  }}
                >
                  Delete Org
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
const styles = {
  page: {
    padding: "2.5rem",
    minHeight: "100vh",
    background: "linear-gradient(180deg, #F7F8FB, #ECEEF7)",
    fontFamily: "Inter, sans-serif",
    color: "#1A1A1A",
    position: "relative",
  },

  title: {
    fontSize: "2.2rem",
    fontWeight: 800,
    marginBottom: "1.5rem",
  },

  logoutBtn: {
    position: "absolute",
    top: 25,
    right: 110,
    background: "#E45050",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
  },

  profile: {
    position: "absolute",
    top: 20,
    right: 25,
    width: "55px",
    height: "55px",
    background: "#FFFFFF",
    borderRadius: "50%",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },

  searchContainer: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginBottom: "2.5rem",
    maxWidth: "450px",
    marginLeft: "0",
  },

  searchBox: {
    background: "#fff",
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    borderRadius: "12px",
    width: "100%",
    border: "1px solid #DDD",
    boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
  },

  searchIcon: { opacity: 0.55, marginRight: "8px" },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "0.95rem",
  },

  filterBtn: {
    padding: "10px",
    borderRadius: "10px",
    background: "#fff",
    border: "1px solid #DDD",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
  },

  sectionHeader: {
    fontSize: "1.35rem",
    fontWeight: 700,
    marginBottom: "8px",
    marginTop: "1rem",
  },

  row: {
    display: "flex",
    gap: "10px",
    maxWidth: "650px",
    marginBottom: "2rem",
    marginLeft: "0",
  },

  input: {
    padding: "11px 13px",
    background: "#fff",
    borderRadius: "10px",
    border: "1px solid #CCC",
    fontSize: "1rem",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 3px 8px rgba(0,0,0,0.03)",
  },

  primaryBtn: {
    background: "#695CEB",
    padding: "11px 20px",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(105,92,235,0.25)",
  },

  card: {
    background: "#fff",
    padding: "1.6rem 1.8rem",
    borderRadius: "18px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.07)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
    maxWidth: "900px",
    marginLeft: "0",
    marginRight: "auto",
  },

  cardLeft: { flex: 1, paddingRight: "1rem" },

  cardTitle: { margin: 0, fontSize: "1.25rem", fontWeight: 700 },

  pin: { marginTop: "4px", marginBottom: "1rem", color: "#444" },

  buttonRow: { display: "flex", gap: "12px", marginTop: "8px" },
};
