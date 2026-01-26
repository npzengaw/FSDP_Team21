import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./OrganisationDashboard.css";

import {
  getMyOrganisations,
  getMembers,
  createOrganisation,
  joinOrganisation,
  leaveOrganisation,
  deleteOrganisation,
} from "../organisation";

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

/* =========================
   Pill component
========================= */
function Pill({ tone = "neutral", children }) {
  const cls = ["pill"];
  if (tone === "brand") cls.push("pill-brand");
  if (tone === "danger") cls.push("pill-danger");
  return <span className={cls.join(" ")}>{children}</span>;
}

export default function OrganisationDashboard({ user, profile }) {
  const navigate = useNavigate();
  const username = profile?.username || "User";

  const [organisations, setOrganisations] = useState([]);
  const [membersByOrg, setMembersByOrg] = useState({});
  const [expanded, setExpanded] = useState({});
  const [pinVisible, setPinVisible] = useState({});

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [newOrgName, setNewOrgName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  const [busy, setBusy] = useState({
    create: false,
    join: false,
    deletingOrgId: null,
    leavingOrgId: null,
  });

  const loadData = async () => {
    setPageError("");
    setLoading(true);

    try {
      const { data: orgs, error: orgErr } = await getMyOrganisations(user.id);
      if (orgErr) throw orgErr;

      const list = orgs || [];
      setOrganisations(list);

      const mems = {};
      for (const org of list) {
        const { data: m, error: memErr } = await getMembers(org.id);
        if (memErr) throw memErr;
        mems[org.id] = m || [];
      }
      setMembersByOrg(mems);
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

  // realtime membership updates
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || organisations.length === 0) return;
    const filterIds = organisations.map((o) => o.id).join(",");

    const channel = supabase
      .channel("member-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "organisation_members", filter: `organisation_id=in.(${filterIds})` },
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
    } catch {
      // ignore
    }
  };

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const togglePin = (id) => setPinVisible((p) => ({ ...p, [id]: !p[id] }));

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = organisations.filter((o) => (o.name || "").toLowerCase().includes(q));

    const withCounts = filtered.map((o) => ({
      ...o,
      _memberCount: (membersByOrg[o.id] || []).length,
    }));

    if (sortBy === "name_asc") withCounts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name_desc") withCounts.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === "members_desc") withCounts.sort((a, b) => (b._memberCount || 0) - (a._memberCount || 0));

    return withCounts;
  }, [organisations, membersByOrg, search, sortBy]);

  if (loading) return <div className="loading">Loading workspaces…</div>;

  return (
    <div className="kiro-page">
      <div className="kiro-container">
        {/* HEADER */}
        <header className="kiro-header">
          <div className="kiro-titleWrap">
            <div className="kiro-breadcrumb">
              <span>Account</span>
              <span style={{ opacity: 0.5 }}>›</span>
              <span style={{ color: "rgba(17,24,39,0.78)" }}>Workspaces</span>
            </div>

            <div className="kiro-titleRow">
              <h1 className="kiro-h1">Workspaces</h1>
              <Pill tone="brand">KIRO</Pill>
            </div>

            <p className="kiro-subtitle">
              Create or join a workspace. Open one to manage shared backlog and tasks.
            </p>

            <div className="kiro-welcome">Welcome, {username}</div>
          </div>

          <div className="kiro-rightHeader">
            <button className="btn" onClick={() => navigate("/kanban")}>
              Go to Kanban
            </button>

            <button className="btn btn-danger" onClick={logout}>
              Logout
            </button>

            <button
              type="button"
              onClick={() => navigate("/profile")}
              title="Open Profile"
              aria-label="Open Profile"
              className="kiro-avatarBtn"
            >
              {username.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {/* Error */}
        {pageError && (
          <div className="errorBox">
            <div>
              <div style={{ fontWeight: 950, marginBottom: 4 }}>Couldn’t load data</div>
              <div style={{ opacity: 0.9 }}>{pageError}</div>
            </div>
            <button className="btn" onClick={loadData}>
              Retry
            </button>
          </div>
        )}

        {/* CREATE + JOIN */}
        <div className="panelGrid">
          <section className="panel" aria-label="Create workspace">
            <div className="panelHeader">
              <h2 className="h2">Create workspace</h2>
              <div className="helper">A PIN is generated for invites</div>
            </div>

            <div className="formCreate">
              <input
                className="input"
                placeholder="Workspace name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />

              <button
                className="btn btn-primary"
                disabled={busy.create}
                onClick={async () => {
                  if (!newOrgName.trim()) return;
                  try {
                    setBusy((b) => ({ ...b, create: true }));
                    const { error } = await createOrganisation(newOrgName, user.id);
                    if (error) throw error;
                    setNewOrgName("");
                    await loadData();
                  } catch (err) {
                    setPageError(safeErrorMessage(err));
                  } finally {
                    setBusy((b) => ({ ...b, create: false }));
                  }
                }}
              >
                {busy.create ? "Creating…" : "Create"}
              </button>
            </div>
          </section>

          <section className="panel" aria-label="Join workspace">
            <div className="panelHeader">
              <h2 className="h2">Join workspace</h2>
              <div className="helper">Use workspace name + PIN</div>
            </div>

            <div className="formJoin">
              <input
                className="input"
                placeholder="Workspace name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
              />
              <input
                className="input"
                placeholder="PIN"
                value={joinPin}
                onChange={(e) => setJoinPin(e.target.value)}
              />

              <button
                className="btn btn-primary"
                disabled={busy.join}
                onClick={async () => {
                  if (!joinName.trim() || !joinPin.trim()) return;
                  try {
                    setBusy((b) => ({ ...b, join: true }));
                    const { error } = await joinOrganisation(joinName, joinPin, user.id);
                    if (error) throw error;
                    setJoinName("");
                    setJoinPin("");
                    await loadData();
                  } catch (err) {
                    setPageError(safeErrorMessage(err));
                  } finally {
                    setBusy((b) => ({ ...b, join: false }));
                  }
                }}
              >
                {busy.join ? "Joining…" : "Join"}
              </button>
            </div>
          </section>
        </div>

        {/* Search + sort */}
        <div className="toolRow">
          <div className="searchWrap">
            <span style={{ opacity: 0.7 }}>🔍</span>
            <input
              className="searchInput"
              placeholder="Search workspaces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name_asc">Sort: Name (A → Z)</option>
            <option value="name_desc">Sort: Name (Z → A)</option>
            <option value="members_desc">Sort: Most members</option>
          </select>
        </div>

        {/* List header */}
        <div className="listHeader">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950 }}>Your workspaces</h2>
          <div className="count">{filteredAndSorted.length} workspace(s)</div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div className="empty">
            <div style={{ fontWeight: 950, marginBottom: 6 }}>No workspaces found</div>
            <div>Try a different search, or create / join a workspace above.</div>
          </div>
        ) : (
          <div className="grid">
            {filteredAndSorted.map((org) => {
              const orgMembers = membersByOrg[org.id] || [];
              const isOwner = org.owner_id === user.id;

              const isDeleting = busy.deletingOrgId === org.id;
              const isLeaving = busy.leavingOrgId === org.id;

              return (
                <div className="card" key={org.id}>
                  <div className="cardTop">
                    <div style={{ display: "grid" }}>
                      <h3 className="cardTitle">{org.name}</h3>
                      <div className="badges">
                        <Pill tone={isOwner ? "brand" : "neutral"}>
                          {isOwner ? "Owner" : "Member"}
                        </Pill>
                        <Pill tone="neutral">👥 {orgMembers.length} members</Pill>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ padding: "9px 12px" }}
                      onClick={() => {
                        localStorage.setItem("activeOrgId", org.id);
                        navigate(`/org/${org.id}/workitems`);
                      }}
                    >
                      Open →
                    </button>
                  </div>

                  <div className="pinRow">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 850, color: "rgba(17,24,39,0.76)" }}>
                        PIN:{" "}
                        <strong style={{ color: "rgba(17,24,39,0.92)" }}>
                          {pinVisible[org.id] ? org.pin : "••••••"}
                        </strong>
                      </span>

                      <button className="btn-tiny" onClick={() => togglePin(org.id)}>
                        {pinVisible[org.id] ? "Hide" : "Show"}
                      </button>
                    </div>

                    <button className="btn-tiny" onClick={() => copyPin(org.pin)}>
                      📋 Copy
                    </button>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {isOwner ? (
                      <button
                        className="btn btn-danger"
                        disabled={isDeleting}
                        onClick={async () => {
                          try {
                            setBusy((b) => ({ ...b, deletingOrgId: org.id }));
                            const { error } = await deleteOrganisation(org.id, user.id);
                            if (error) throw error;
                            await loadData();
                          } catch (err) {
                            setPageError(safeErrorMessage(err));
                          } finally {
                            setBusy((b) => ({ ...b, deletingOrgId: null }));
                          }
                        }}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    ) : (
                      <button
                        className="btn btn-danger"
                        disabled={isLeaving}
                        onClick={async () => {
                          try {
                            setBusy((b) => ({ ...b, leavingOrgId: org.id }));
                            const { error } = await leaveOrganisation(org.id, user.id);
                            if (error) throw error;
                            await loadData();
                          } catch (err) {
                            setPageError(safeErrorMessage(err));
                          } finally {
                            setBusy((b) => ({ ...b, leavingOrgId: null }));
                          }
                        }}
                      >
                        {isLeaving ? "Leaving…" : "Leave"}
                      </button>
                    )}
                  </div>

                  <button className="linkBtn" onClick={() => toggleExpand(org.id)}>
                    {expanded[org.id] ? "Hide members ▲" : "View members ▼"}
                  </button>

                  {expanded[org.id] && (
                    <div className="members">
                      {orgMembers.map((m) => {
                        const displayName = (m.username || "").trim() || "User";
                        const isOwnerRow = m.role === "owner" || m.user_id === org.owner_id;

                        return (
                          <div key={m.user_id} className="memberItem">
                            <span style={{ fontWeight: 800, color: "rgba(17,24,39,0.92)" }}>
                              {displayName}
                            </span>
                            <span style={{ opacity: 0.8 }}>{isOwnerRow ? "(Owner)" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
