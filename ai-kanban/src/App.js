import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import LoginPage from "./LoginPage";
import { supabase } from "./supabaseClient.js";
import KanbanBoard from "./KanbanBoard";
import {
  createOrganisation,
  joinOrganisation,
  getMyOrganisations,
  getMembers,
  kickMember,
} from "./organisation.js";
import { signUpUser, signIn, signOut, getCurrentUser, getCurrentProfile } from "./Auth.js";


function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSettingUpProfile, setIsSettingUpProfile] = useState(false);
  const [createOrgName, setCreateOrgName] = useState("");
  const [joinOrgName, setJoinOrgName] = useState("");
  const [joinOrgPin, setJoinOrgPin] = useState("");
  const [organisations, setOrganisations] = useState([]);
  const [members, setMembers] = useState({});
  const [expandedMembers, setExpandedMembers] = useState({});
  const [copied, setCopied] = useState(false);

  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [avatarColor, setAvatarColor] = useState(
    "#" + Math.floor(Math.random() * 16777215).toString(16)
  );

  // --- Load current user & profile ---
  const loadCurrentUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setUser(null);
      setProfile(null);
      return;
    }
    setUser(data.user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profileData) setIsSettingUpProfile(true);
    else {
      setProfile(profileData);
      setIsSettingUpProfile(false);
    }
  }, []);

  // --- Save profile setup ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!username.trim() || !description.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          username: username.trim(),
          description: description.trim(),
          avatar_color: avatarColor,
          avatar_url: null,
        },
      ])
      .select()
      .maybeSingle();

    if (error) return alert("Error creating profile: " + error.message);

    setProfile(newProfile);
    setIsSettingUpProfile(false);
  };

  // --- Load organisations and members ---
  const loadUserOrganisations = useCallback(async () => {
    if (!user) return;

    const { data: orgs, error } = await getMyOrganisations(user.id);
    if (error) return console.error("Error fetching organisations:", error);

    setOrganisations(orgs || []);

    const memberData = {};
    for (let org of orgs || []) {
      const { data: orgMembers, error: membersError } = await getMembers(org.id);
      if (!membersError) {
        const memberProfiles = await Promise.all(
          (orgMembers || []).map(async (m) => {
            const { data: p } = await supabase
              .from("profiles")
              .select("username, description, avatar_color")
              .eq("id", m.user_id)
              .maybeSingle();
            return { ...m, ...p };
          })
        );
        memberData[org.id] = memberProfiles;
      }
    }
    setMembers(memberData);
  }, [user]);

  useEffect(() => {
    loadCurrentUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) loadCurrentUser();
      else setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadCurrentUser]);

  useEffect(() => {
    loadUserOrganisations();
  }, [loadUserOrganisations]);

  // --- AUTH ---
  const handleSignup = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (!email || !password) return alert("Email and password required.");

    const { data, error } = await signUpUser(email, password);
    if (error) return alert(error.message);

    alert("Signed up successfully! Please confirm your email before logging in.");
  };

  const handleLogin = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (!email || !password) return alert("Email and password required.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return alert(error.message);

    setUser(data.user);
    loadCurrentUser();
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return alert(error.message);

    setUser(null);
    setProfile(null);
    setOrganisations([]);
    setMembers({});
    setExpandedMembers({});
  };

  // --- ORGANISATION ---
  const handleCreateOrg = async () => {
    if (!user) return alert("Please log in first.");
    if (!createOrgName) return alert("Enter an organisation name.");

    const { data, error } = await createOrganisation(createOrgName, user.id);
    if (error) return alert(error.message);

    alert(`Organisation "${createOrgName}" created! Your PIN: ${data.pin}`);
    setCreateOrgName("");
    loadUserOrganisations();
  };

  const handleJoinOrg = async () => {
    if (!user) return alert("Please log in first.");
    if (!joinOrgName || !joinOrgPin) return alert("Enter both name and PIN.");

    const { error } = await joinOrganisation(joinOrgName, joinOrgPin, user.id);
    if (error) return alert(error.message);

    alert(`Joined organisation "${joinOrgName}" successfully!`);
    setJoinOrgName("");
    setJoinOrgPin("");
    loadUserOrganisations();
  };

  const handleKick = async (orgId, memberId) => {
    if (!orgId || !memberId) return alert("Org ID and member ID are required.");

    const { error } = await kickMember(orgId, memberId, user.id);
    if (error) return alert(error.message);

    alert("Member kicked!");
    loadUserOrganisations();
  };

  const handleCopyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleMemberDetails = (orgId, memberId) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [orgId]: { ...prev[orgId], [memberId]: !prev[orgId]?.[memberId] },
    }));
  };

  // --- JSX ---
if (!user)
  return (
    <LoginPage
      onLogin={async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return alert(error.message);
        setUser(data.user);
        loadCurrentUser();
      }}
      onSignup={async (email, password) => {
        if (!email || !password) return alert("Please fill in both fields.");
        const { data, error } = await signUpUser(email, password);
        if (error) return alert(error.message);
        alert("Account created! Please verify your email before logging in.");
      }}
    />
  );


  if (isSettingUpProfile)
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Set Up Your Profile</h2>
        <form
          onSubmit={handleSaveProfile}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "300px" }}
        >
          <label>Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />

          <label>Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required />

          <label>Avatar Color</label>
          <input type="color" value={avatarColor} onChange={(e) => setAvatarColor(e.target.value)} />

          <button type="submit">Save Profile</button>
        </form>
      </div>
    );

  return (
    <div style={{ padding: "2rem" }}>
      <h1>AI Kanban Demo</h1>
      <p>
        Logged in as: <strong>{profile?.username || user.email}</strong>
      </p>
      <p style={{ color: profile?.avatar_color }}>{profile?.description}</p>
      <button onClick={handleLogout}>Logout</button>

      <hr />
      <h2>Create Organisation</h2>
      <input placeholder="Organisation Name" value={createOrgName} onChange={(e) => setCreateOrgName(e.target.value)} />
      <button onClick={handleCreateOrg}>Create</button>

      <hr />
      <h2>Join Organisation</h2>
      <input placeholder="Organisation Name" value={joinOrgName} onChange={(e) => setJoinOrgName(e.target.value)} />
      <input placeholder="Organisation PIN" value={joinOrgPin} onChange={(e) => setJoinOrgPin(e.target.value)} />
      <button onClick={handleJoinOrg}>Join</button>

      <hr />
      <h2>Your Organisations & Members</h2>
      {organisations.length === 0 ? (
        <p>No organisations yet.</p>
      ) : (
        organisations.map((org) => (
          <div key={org.id} style={{ border: "1px solid #ccc", margin: "1rem 0", padding: "0.5rem", borderRadius: "8px" }}>
            <h3>{org.name}</h3>
            {user.id === org.owner_id && (
              <p>
                <strong>PIN:</strong> {org.pin}{" "}
                <button onClick={() => handleCopyPin(org.pin)}>{copied ? "Copied!" : "Copy PIN"}</button>
              </p>
            )}
            <p>
              <strong>Owner:</strong> {org.owner_id === user.id ? "You" : org.owner_id}
            </p>
            <strong>Members:</strong>
            <ul>
              {members[org.id]?.length === 0 && <li>No members yet.</li>}
              {members[org.id]?.map((m) => (
                <li key={m.user_id} style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                    onClick={() => toggleMemberDetails(org.id, m.user_id)}
                  >
                    {/* Avatar circle */}
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: m.avatar_color || "#000",
                        marginRight: "8px",
                      }}
                    ></div>
                    <span>{m.username} - {m.role}</span>
                    {user.id === org.owner_id && (
                      <button
                        style={{ marginLeft: "auto" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKick(org.id, m.user_id);
                        }}
                      >
                        Kick
                      </button>
                    )}
                  </div>

                  {expandedMembers[org.id]?.[m.user_id] && (
                    <div style={{ paddingLeft: "24px", marginTop: "0.25rem", color: m.avatar_color || "#000" }}>
                      <p><strong>Description:</strong> {m.description}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <hr />
      <h2>Kanban Board</h2>
      <KanbanBoard />
    </div>
  );
}

export default App;
