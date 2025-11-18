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

  // SAFE DISPLAY NAME
  const displayName = profile?.username || "User";
  const [organisations, setOrganisations] = useState([]);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);

  const [newOrgName, setNewOrgName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPin, setJoinPin] = useState("");

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

  // MEMBER updates
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
    if (!joinName.trim() || !joinPin.trim())
      return alert("Enter all fields");

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
    if (!window.confirm("Delete this organisation? This cannot be undone."))
      return;

    const { error } = await deleteOrganisation(orgId, user.id);
    if (error) return alert(error.message);

    loadData();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", position: "relative" }}>
      {/* TOP RIGHT */}
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <button
          onClick={handleLogout}
          style={{
            padding: "6px 12px",
            background: "#d9534f",
            color: "white",
            borderRadius: "4px",
          }}
        >
          Logout
        </button>
      </div>

      {/* WELCOME */}
      <h1>Welcome, {displayName}</h1>

      {/* CREATE */}
      <div style={{ marginTop: "2rem" }}>
        <h2>Create Organisation</h2>
        <input
          placeholder="Org Name"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
        />
        <button onClick={handleCreateOrg} style={{ marginLeft: "8px" }}>
          Create
        </button>
      </div>

      {/* JOIN */}
      <div style={{ marginTop: "2rem" }}>
        <h2>Join Organisation</h2>
        <input
          placeholder="Organisation Name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />
        <input
          placeholder="PIN"
          value={joinPin}
          style={{ marginLeft: "8px" }}
          onChange={(e) => setJoinPin(e.target.value)}
        />
        <button onClick={handleJoinOrg} style={{ marginLeft: "8px" }}>
          Join
        </button>
      </div>

      {/* WORKSPACES */}
      <h2 style={{ marginTop: "3rem" }}>Your Workspaces</h2>

      {organisations.length === 0 ? (
        <p>No organisations yet.</p>
      ) : (
        organisations.map((org) => (
          <div
            key={org.id}
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <h3>{org.name}</h3>
            <p>
              <strong>PIN:</strong> {org.pin}
            </p>

            <strong>Members:</strong>
            <ul>
              {members[org.id]?.map((m) => (
                <li key={m.user_id}>
                  {m.username} — {m.role}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate(`/org/${org.id}`)}
              style={{ marginTop: "10px" }}
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
        ))
      )}
    </div>
  );
}
