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

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =========================
   Badge component
========================= */
function Badge({ variant = "neutral", icon, children }) {
  const cls = ["badge"];
  if (variant === "primary") cls.push("badge-primary");
  if (variant === "success") cls.push("badge-success");
  if (variant === "warning") cls.push("badge-warning");
  if (variant === "danger") cls.push("badge-danger");
  if (variant === "info") cls.push("badge-info");
  
  return (
    <span className={cls.join(" ")}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
}

/* =========================
   Stats Card
========================= */
function StatsCard({ icon, label, value, trend }) {
  return (
    <div className="stats-card">
      <div className="stats-icon">{icon}</div>
      <div className="stats-content">
        <div className="stats-label">{label}</div>
        <div className="stats-value">{value}</div>
        {trend && <div className="stats-trend">{trend}</div>}
      </div>
    </div>
  );
}

export default function OrganisationDashboard({ user, profile }) {
  const navigate = useNavigate();
  const username = profile?.username || "User";
  const userInitials = username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
  const [viewMode, setViewMode] = useState("grid"); // grid or list

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
      // Could add toast notification here
    } catch {
      // ignore
    }
  };

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const togglePin = (id) => setPinVisible((p) => ({ ...p, [id]: !p[id] }));

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = organisations.filter((o) =>
      (o.name || "").toLowerCase().includes(q)
    );

    const withCounts = filtered.map((o) => ({
      ...o,
      _memberCount: (membersByOrg[o.id] || []).length,
    }));

    if (sortBy === "name_asc")
      withCounts.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "name_desc")
      withCounts.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === "members_desc")
      withCounts.sort((a, b) => (b._memberCount || 0) - (a._memberCount || 0));
    if (sortBy === "recent")
      withCounts.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

    return withCounts;
  }, [organisations, membersByOrg, search, sortBy]);

  // Stats calculations
  const totalOrgs = organisations.length;
  const ownedOrgs = organisations.filter((o) => o.owner_id === user?.id).length;
  const memberOrgs = totalOrgs - ownedOrgs;
  const totalMembers = Object.values(membersByOrg).reduce(
    (sum, members) => sum + members.length,
    0
  );

  if (loading) {
    return (
      <div className="enterprise-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading Workspace Management System...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-page">
      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="logo-section">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div className="logo-text">
              <div className="logo-title">Workspace Management</div>
              <div className="logo-subtitle">Enterprise System</div>
            </div>
          </div>
        </div>

        <div className="nav-right">
          <button className="nav-btn" onClick={() => navigate("/kanban")}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Kanban Board
          </button>

            <button className="nav-btn" onClick={() => navigate("/chat")}>
              Chat
            </button>

          <button className="nav-btn nav-btn-secondary" onClick={logout}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>

          <button
            className="user-avatar"
            onClick={() => navigate("/profile")}
            title="View Profile"
          >
            {userInitials}
          </button>
        </div>
      </nav>

      <div className="enterprise-container">
        {/* Header Section */}
        <header className="page-header">
          <div className="header-content">
            <div className="breadcrumb">
              <span className="breadcrumb-item">System</span>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-item">Account Management</span>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-item breadcrumb-active">
                Workspaces
              </span>
            </div>

            <h1 className="page-title">Workspace Overview</h1>
            <p className="page-description">
              Manage organizational workspaces, collaborate with teams, and
              control access permissions across your enterprise environment.
            </p>

            <div className="user-info">
              <div className="user-info-label">Current User</div>
              <div className="user-info-value">{username}</div>
            </div>
          </div>
        </header>

        {/* Stats Dashboard */}
        <div className="stats-grid">
          <StatsCard
            icon="📊"
            label="Total Workspaces"
            value={totalOrgs}
            trend={`${ownedOrgs} owned, ${memberOrgs} member`}
          />
          <StatsCard
            icon="👥"
            label="Total Members"
            value={totalMembers}
            trend="Across all workspaces"
          />
          <StatsCard
            icon="🔐"
            label="Owned Workspaces"
            value={ownedOrgs}
            trend="Full administrative access"
          />
          <StatsCard
            icon="🤝"
            label="Member Access"
            value={memberOrgs}
            trend="Collaborative workspaces"
          />
        </div>

        {/* Error Display */}
        {pageError && (
          <div className="alert alert-error">
            <div className="alert-icon">⚠</div>
            <div className="alert-content">
              <div className="alert-title">System Error</div>
              <div className="alert-message">{pageError}</div>
            </div>
            <button className="btn btn-sm" onClick={loadData}>
              Retry
            </button>
          </div>
        )}

        {/* Action Panels */}
        <div className="action-grid">
          <section className="action-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="panel-title">Create New Workspace</h2>
                  <p className="panel-subtitle">
                    Initialize a new organizational workspace with secure PIN
                    generation
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-body">
              <div className="form-group">
                <label className="form-label">Workspace Name</label>
                <input
                  className="form-input"
                  placeholder="Enter workspace identifier"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  disabled={busy.create}
                />
              </div>

              <button
                className="btn btn-primary btn-block"
                disabled={busy.create || !newOrgName.trim()}
                onClick={async () => {
                  if (!newOrgName.trim()) return;
                  try {
                    setBusy((b) => ({ ...b, create: true }));
                    const { error } = await createOrganisation(
                      newOrgName,
                      user.id
                    );
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
                {busy.create ? (
                  <>
                    <span className="spinner-sm"></span>
                    Creating Workspace...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      width="18"
                      height="18"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Create Workspace
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="action-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-icon panel-icon-secondary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="panel-title">Join Existing Workspace</h2>
                  <p className="panel-subtitle">
                    Request access using workspace credentials and secure PIN
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Workspace Name</label>
                  <input
                    className="form-input"
                    placeholder="Workspace identifier"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    disabled={busy.join}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Access PIN</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="6-digit PIN"
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value)}
                    disabled={busy.join}
                    maxLength={6}
                  />
                </div>
              </div>

              <button
                className="btn btn-secondary btn-block"
                disabled={busy.join || !joinName.trim() || !joinPin.trim()}
                onClick={async () => {
                  if (!joinName.trim() || !joinPin.trim()) return;
                  try {
                    setBusy((b) => ({ ...b, join: true }));
                    const { error } = await joinOrganisation(
                      joinName,
                      joinPin,
                      user.id
                    );
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
                {busy.join ? (
                  <>
                    <span className="spinner-sm"></span>
                    Joining Workspace...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      width="18"
                      height="18"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      />
                    </svg>
                    Request Access
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Workspace List Controls */}
        <div className="list-controls">
          <div className="list-controls-left">
            <h2 className="section-title">Workspace Directory</h2>
            <Badge variant="info">{filteredAndSorted.length} Active</Badge>
          </div>

          <div className="list-controls-right">
            <div className="search-box">
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                className="search-input"
                placeholder="Search workspaces..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="select-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="members_desc">Most Members</option>
              <option value="recent">Recently Created</option>
            </select>

            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Cards */}
        {filteredAndSorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="empty-title">No Workspaces Found</h3>
            <p className="empty-description">
              {search
                ? "No workspaces match your search criteria. Try adjusting your filters."
                : "Get started by creating a new workspace or joining an existing one using the panels above."}
            </p>
            {search && (
              <button className="btn btn-sm" onClick={() => setSearch("")}>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className={`workspace-${viewMode}`}>
            {filteredAndSorted.map((org) => {
              const orgMembers = membersByOrg[org.id] || [];
              const isOwner = org.owner_id === user.id;
              const isDeleting = busy.deletingOrgId === org.id;
              const isLeaving = busy.leavingOrgId === org.id;

              return (
                <div className="workspace-card" key={org.id}>
                  <div className="workspace-header">
                    <div className="workspace-header-left">
                      <div className="workspace-icon">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="workspace-info">
                        <h3 className="workspace-name">{org.name}</h3>
                        <div className="workspace-meta">
                          <Badge variant={isOwner ? "primary" : "neutral"}>
                            {isOwner ? "Administrator" : "Member"}
                          </Badge>
                          <Badge variant="info" icon="👥">
                            {orgMembers.length} Members
                          </Badge>
                          {org.created_at && (
                            <span className="workspace-date">
                              Created {formatDate(org.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        localStorage.setItem("activeOrgId", org.id);
                        navigate(`/org/${org.id}/workitems`);
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        width="18"
                        height="18"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      Access Workspace
                    </button>
                  </div>

                  <div className="workspace-body">
                    <div className="credential-box">
                      <div className="credential-header">
                        <svg
                          className="credential-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span className="credential-label">Access PIN</span>
                      </div>

                      <div className="credential-content">
                        <code className="credential-value">
                          {pinVisible[org.id] ? org.pin : "••••••"}
                        </code>

                        <div className="credential-actions">
                          <button
                            className="credential-btn"
                            onClick={() => togglePin(org.id)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              {pinVisible[org.id] ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                />
                              ) : (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              )}
                            </svg>
                            {pinVisible[org.id] ? "Hide" : "Show"}
                          </button>

                          <button
                            className="credential-btn"
                            onClick={() => copyPin(org.pin)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="workspace-actions">
                      {isOwner ? (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={isDeleting}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Are you sure you want to delete "${org.name}"? This action cannot be undone.`
                              )
                            )
                              return;

                            try {
                              setBusy((b) => ({
                                ...b,
                                deletingOrgId: org.id,
                              }));
                              const { error } = await deleteOrganisation(
                                org.id,
                                user.id
                              );
                              if (error) throw error;
                              await loadData();
                            } catch (err) {
                              setPageError(safeErrorMessage(err));
                            } finally {
                              setBusy((b) => ({ ...b, deletingOrgId: null }));
                            }
                          }}
                        >
                          {isDeleting ? (
                            <>
                              <span className="spinner-sm"></span>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                width="16"
                                height="16"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete Workspace
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={isLeaving}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Are you sure you want to leave "${org.name}"?`
                              )
                            )
                              return;

                            try {
                              setBusy((b) => ({ ...b, leavingOrgId: org.id }));
                              const { error } = await leaveOrganisation(
                                org.id,
                                user.id
                              );
                              if (error) throw error;
                              await loadData();
                            } catch (err) {
                              setPageError(safeErrorMessage(err));
                            } finally {
                              setBusy((b) => ({ ...b, leavingOrgId: null }));
                            }
                          }}
                        >
                          {isLeaving ? (
                            <>
                              <span className="spinner-sm"></span>
                              Leaving...
                            </>
                          ) : (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                width="16"
                                height="16"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                              </svg>
                              Leave Workspace
                            </>
                          )}
                        </button>
                      )}

                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleExpand(org.id)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          width="16"
                          height="16"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        {expanded[org.id] ? "Hide Members" : "View Members"}
                      </button>
                    </div>

                    {expanded[org.id] && (
                      <div className="members-list">
                        <div className="members-header">
                          <h4 className="members-title">Workspace Members</h4>
                          <Badge variant="neutral">
                            {orgMembers.length} Total
                          </Badge>
                        </div>

                        <div className="members-grid">
                          {orgMembers.map((m) => {
                            const displayName =
                              (m.username || "").trim() || "User";
                            const isOwnerRow =
                              m.role === "owner" || m.user_id === org.owner_id;
                            const initials = displayName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2);

                            return (
                              <div key={m.user_id} className="member-card">
                                <div className="member-avatar">{initials}</div>
                                <div className="member-info">
                                  <div className="member-name">
                                    {displayName}
                                  </div>
                                  <div className="member-role">
                                    {isOwnerRow ? (
                                      <Badge variant="primary" icon="👑">
                                        Administrator
                                      </Badge>
                                    ) : (
                                      <Badge variant="neutral">
                                        Member
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="page-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p className="footer-text">
              Enterprise Workspace Management System • Secure Collaboration
              Platform
            </p>
          </div>
          <div className="footer-right">
            <span className="footer-status">
              <span className="status-indicator"></span>
              System Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}