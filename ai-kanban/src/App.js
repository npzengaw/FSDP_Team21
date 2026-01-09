import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

import Layout from "./Layout";
import Dashboard from "./Dashboard";
import WorkItems from "./WorkItems";
import OrgBoardPage from "./pages/OrgBoardPage";

// ✅ bring back org page
import OrganisationDashboard from "./pages/OrganisationDashboard";

import { supabase } from "./supabaseClient";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadProfile = async (userId) => {
    if (!userId) return setProfile(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.error("loadProfile error:", error);
    setProfile(data || null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

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

  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route
          path="/"
          element={!user ? <LoginPage /> : <Navigate to="/kanban" />}
        />

        {/* SIGNUP */}
        <Route
          path="/signup"
          element={!user ? <SignupPage /> : <Navigate to="/kanban" />}
        />

        {/* ✅ ORGANISATIONS PAGE (WORKSPACES) */}
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

        {/* PERSONAL KANBAN (HOME) */}
        <Route
          path="/kanban"
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

        {/* PERSONAL DASHBOARD */}
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

        {/* PERSONAL WORK ITEMS */}
        <Route
          path="/workitems"
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

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to={user ? "/kanban" : "/"} />} />
      </Routes>
    </BrowserRouter>
  );
}
