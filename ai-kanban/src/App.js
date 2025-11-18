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
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.error("Profile load error:", error);

    setProfile(data || null);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        await loadProfile(data.user.id);
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

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

        {/* ORGANISATION PAGE — NO SIDEBAR */}
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

        {/* KANBAN BOARD — WITH SIDEBAR */}
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

        {/* DASHBOARD — WITH SIDEBAR */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <Layout>
                <Dashboard />
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
            user ? <WorkItems user={user} profile={profile} /> : <Navigate to="/" />
          }
        />


      </Routes>
    </BrowserRouter>
  );
}
