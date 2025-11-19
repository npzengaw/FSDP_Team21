import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import OrganisationDashboard from "./pages/OrganisationDashboard";
import OrgBoardPage from "./pages/OrgBoardPage";
import Dashboard from "./Dashboard";
import Layout from "./Layout";
import WorkItems from "./WorkItems";

import { supabase } from "./supabaseClient";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // --- Load profile -------------------------------------------------------
  const loadProfile = async (userId) => {
    if (!userId) return setProfile(null);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    setProfile(data || null);
  };

  // --- Listen to auth changes (NO INITIAL LOADING SCREEN) -----------------
  useEffect(() => {
    // Immediately attempt session restore
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadProfile(u.id);
    });

    // Listen for login / logout / token refresh
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user || null;
        setUser(u);
        if (u) loadProfile(u.id);
        else setProfile(null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Routes --------------------------------------------------------------
  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/"
          element={!user ? <LoginPage /> : <Navigate to="/organisations" />}
        />

        {/* SIGNUP */}
        <Route
          path="/signup"
          element={!user ? <SignupPage /> : <Navigate to="/organisations" />}
        />

        {/* ORGANISATIONS */}
        <Route
          path="/organisations"
          element={
            user ? (
              <OrganisationDashboard user={user} profile={profile} />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* KANBAN BOARD */}
        <Route
          path="/org/:orgId"
          element={
            user ? (
              <Layout>
                <OrgBoardPage user={user} profile={profile} />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <Layout>
                <Dashboard user={user} profile={profile} />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* LIST VIEW */}
        <Route
          path="/org/:orgId/workitems"
          element={
            user ? (
              <Layout>
                <WorkItems user={user} profile={profile} />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
