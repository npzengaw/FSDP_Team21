
// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { io } from "socket.io-client";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

import Layout from "./Layout";
import Dashboard from "./Dashboard";
import WorkItems from "./WorkItems";
import ProfilePage from "./pages/ProfilePage";
import KanbanBoard from "./KanbanBoard";

import { LocaleProvider } from "./LocaleContext";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import TimelineView from "./TimelineView";
import OrganisationDashboard from "./pages/OrganisationDashboard";
import Chat from "./Chat";

import { supabase } from "./supabaseClient";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [socket, setSocket] = useState(null);

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

  // ✅ AUTH FIRST
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

  // ✅ SOCKET AFTER USER EXISTS
  useEffect(() => {
    if (!user?.id) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      return;
    }

    const s = io("http://localhost:5000", {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 8000,
      query: { userId: user.id },
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user?.id]);

  // ✅ Auto-refresh profile
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("profiles-watch")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => loadProfile(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const activeOrgId = window.localStorage.getItem("activeOrgId");

  return (
    <BrowserRouter>
      <LocaleProvider profile={profile}>
        <Routes>
          {/* LOGIN */}
          <Route path="/" element={!user ? <LoginPage /> : <Navigate to="/home" />} />
<Route path="/signup" element={!user ? <SignupPage /> : <Navigate to="/home" />} />


          {/* SIGNUP */}
          <Route
            path="/signup"
            element={!user ? <SignupPage /> : <Navigate to="/kanban" />}
          />

          {/* Reset password */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* HOME (org-aware) */}
          <Route
            path="/home"
            element={
              user ? (
                activeOrgId ? (
                  <Navigate to={`/org/${activeOrgId}/kanban`} />
                ) : (
                  <Navigate to="/kanban" />
                )
              ) : (
                <Navigate to="/" />
              )
            }
          />


          {/* Organisations */}
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

          {/* Profile */}
          <Route
            path="/profile"
            element={
              user ? (
                <ProfilePage
                  user={user}
                  profile={profile}
                  onProfileUpdated={() => loadProfile(user.id)}
                />
              ) : (
                <Navigate to="/" />
              )
            }
          />

          {/* PERSONAL KANBAN */}
          <Route
            path="/kanban"
            element={
              user ? (
                <Layout>
                  <KanbanBoard socket={socket} user={user} profile={profile} />
                </Layout>
              ) : (
                <Navigate to="/" />
              )
            }
          />

          {/* ORG KANBAN */}
          <Route
            path="/org/:id/kanban"
            element={
              user ? (
                <Layout>
                  <KanbanBoard socket={socket} user={user} profile={profile} />
                </Layout>
              ) : (
                <Navigate to="/" />
              )
            }
          />

          {/* ORG WORKITEMS */}
          <Route
            path="/org/:id/workitems"
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


          {/* TIMELINE */}
          <Route
            path="/timeline"
            element={
              user ? (
                <Layout>
                  <TimelineView user={user} profile={profile} />
                </Layout>
              ) : (
                <Navigate to="/" />
              )
            }
          />
        {/* CHAT */}
        <Route path="/chat" element={<Chat />} />

          {/* CATCH-ALL */}
          <Route path="*" element={<Navigate to={user ? "/home" : "/"} />} />
        </Routes>
      </LocaleProvider>
    </BrowserRouter>
  );
}
