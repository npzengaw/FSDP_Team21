import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import OrganisationDashboard from "./pages/OrganisationDashboard";
import OrgBoardPage from "./pages/OrgBoardPage";

import { supabase } from "./supabaseClient";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // -----------------------------
  // Load profile
  // -----------------------------
  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    setProfile(data || null);
  };

  // -----------------------------
  // Initial load + session listener
  // -----------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        loadProfile(data.user.id);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // -----------------------------
  // NO MORE LOADING SCREEN
  // App renders instantly
  // -----------------------------

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

        {/* ORG DASHBOARD */}
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

        {/* ORG BOARD */}
        <Route
          path="/org/:orgId"
          element={
            user ? (
              <OrgBoardPage user={user} profile={profile} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
