// src/pages/ProfilePage.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useLocale } from "../LocaleContext";

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

function formatDateMaybe(value) {
  try {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function extFromFile(file) {
  const parts = (file?.name || "").split(".");
  const ext = parts.length > 1 ? parts.pop() : "png";
  return (ext || "png").toLowerCase();
}

function isImageFile(file) {
  return !!file && file.type?.startsWith("image/");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    try {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

/* =========================
   toast notification
========================= */
function Toast({ toast, onClose, reduceMotion }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const tone = toast.tone || "neutral";
  const toneMap = {
    neutral: { bg: "rgba(255,255,255,0.96)", border: "rgba(15,23,42,0.08)", text: "#0f172a" },
    success: { bg: "rgba(16,185,129,0.95)", border: "rgba(255,255,255,0.25)", text: "#fff" },
    danger: { bg: "rgba(239,68,68,0.95)", border: "rgba(255,255,255,0.25)", text: "#fff" },
    info: { bg: "rgba(106,61,240,0.95)", border: "rgba(255,255,255,0.25)", text: "#fff" }, // purple hint
    warning: { bg: "rgba(245,158,11,0.95)", border: "rgba(255,255,255,0.25)", text: "#fff" },
  };

  const config = toneMap[tone] || toneMap.neutral;

  return (
    <div
      className={`_toast ${reduceMotion ? "_rm" : ""}`}
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="_toastIcon">{toast.icon || "ℹ️"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="_toastTitle">{toast.title || "Notification"}</div>
        {toast.message && <div className="_toastMsg">{toast.message}</div>}
      </div>
      <button className="_iconBtn _toastClose" onClick={onClose} aria-label="Close notification">
        ✕
      </button>
    </div>
  );
}

/* =========================
   modal
========================= */
function Modal({ open, title, subtitle, children, footer, onClose, danger, reduceMotion }) {
  if (!open) return null;

  return (
    <div className={`_modalBackdrop ${reduceMotion ? "_rm" : ""}`} onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className="_modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className={`_modalHeader ${danger ? "_danger" : ""}`}>
          <div>
            <div className="_modalTitle">{title}</div>
            {subtitle && <div className="_modalSub">{subtitle}</div>}
          </div>
          <button className="_iconBtn _modalClose" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="_modalBody">{children}</div>

        {footer && <div className="_modalFooter">{footer}</div>}
      </div>
    </div>
  );
}

/* =========================
   UI Components
========================= */
function Badge({ children, variant = "default" }) {
  return <span className={`_badge _b_${variant}`}>{children}</span>;
}

function Button({ children, variant = "ghost", disabled, onClick, type = "button" }) {
  return (
    <button type={type} className={`_btn _v_${variant}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <div className="_switchRow">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="_switchLabel">{label}</div>
        {description && <div className="_switchDesc">{description}</div>}
      </div>

      <button
        type="button"
        className={`_switch ${checked ? "_on" : ""}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
      >
        <span className="_switchKnob" />
      </button>
    </div>
  );
}

function Card({ title, subtitle, children, actions, variant = "default" }) {
  return (
    <section className="_card" aria-label={title}>
      <div className={`_cardHeader ${variant === "danger" ? "_danger" : ""}`}>
        <div>
          <div className="_cardTitle">{title}</div>
          {subtitle && <div className="_cardSub">{subtitle}</div>}
        </div>
        {actions}
      </div>
      <div className="_cardBody">{children}</div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="_skCard">
      <div className="_skLine _w60" />
      <div className="_skLine _w90" />
      <div className="_skLine _w70" />
    </div>
  );
}

/* =========================
   Main Profile Page
========================= */
export default function ProfilePage({ user, profile, onProfileUpdated }) {
  const navigate = useNavigate();
  const { locale, setLocale, timezone, setTimezone } = useLocale();

  const [tab, setTab] = useState("profile");
  const [toast, setToast] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [sendingReset, setSendingReset] = useState(false);
  const [signOutOthersBusy, setSignOutOthersBusy] = useState(false);
  const [signOutAllBusy, setSignOutAllBusy] = useState(false);

  const [confirm, setConfirm] = useState({ open: false, intent: "", title: "", subtitle: "" });

  const [dbProfile, setDbProfile] = useState(profile || null);
  const [sessionUser, setSessionUser] = useState(null);

  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(user?.email || "");

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [theme, setTheme] = useState(profile?.theme || "system");
  const [emailNotif, setEmailNotif] = useState(profile?.email_notif ?? true);
  const [inappNotif, setInappNotif] = useState(profile?.inapp_notif ?? true);
  const [reduceMotion, setReduceMotion] = useState(profile?.reduce_motion ?? false);

  const showToast = (payload) => setToast(payload);

  /* =========================
     load profile + auth user
  ========================= */
  useEffect(() => {
    let mounted = true;

    async function load() {
      setPageError("");
      try {
        setLoading(true);

        if (!user?.id) {
          setPageError("No user session found. Please log in again.");
          return;
        }

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;

        const { data, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        if (!mounted) return;

        setDbProfile(p || null);
        setUsername(p?.username || "");
        setAvatarUrl(p?.avatar_url || "");
        setTheme(p?.theme || "system");
        setEmailNotif(p?.email_notif ?? true);
        setInappNotif(p?.inapp_notif ?? true);
        setReduceMotion(p?.reduce_motion ?? false);

        setSessionUser(data?.user || null);
        setEmail(user?.email || data?.user?.email || "");
      } catch (err) {
        if (mounted) setPageError(safeErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.email]);

  // Optional: make reduce motion actually affect page animations
  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) root.classList.add("_reduceMotion");
    else root.classList.remove("_reduceMotion");
  }, [reduceMotion]);

  const displayName = (username?.trim() || dbProfile?.username || "User").trim();
  const firstLetter = (displayName || "U").slice(0, 1).toUpperCase();

  const lastSignIn = sessionUser?.last_sign_in_at || sessionUser?.last_sign_in || null;
  const createdAt = sessionUser?.created_at || null;

  const avatarPublicUrl = useMemo(() => {
    if (!avatarUrl) return "";
    if (avatarUrl.startsWith("http")) return avatarUrl;
    const { data } = supabase.storage.from("avatars").getPublicUrl(avatarUrl);
    return data?.publicUrl || "";
  }, [avatarUrl]);

  const prefsDirty =
    locale !== (dbProfile?.locale || "en") ||
    timezone !== (dbProfile?.timezone || "Asia/Singapore") ||
    theme !== (dbProfile?.theme || "system") ||
    emailNotif !== (dbProfile?.email_notif ?? true) ||
    inappNotif !== (dbProfile?.inapp_notif ?? true) ||
    reduceMotion !== (dbProfile?.reduce_motion ?? false);

  const profileDirty = username.trim() !== (dbProfile?.username || "");

  /* =========================
     actions
  ========================= */
  const doLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  };

  const refreshLocalProfile = async () => {
    if (!user?.id) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setDbProfile(p || null);
  };

  const saveUsername = async () => {
    const next = username.trim();
    if (!next) {
      showToast({ tone: "warning", icon: "⚠️", title: "Validation Error", message: "Username cannot be empty." });
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ username: next }).eq("id", user.id);
      if (error) throw error;

      await refreshLocalProfile();
      if (typeof onProfileUpdated === "function") onProfileUpdated();

      showToast({ tone: "success", icon: "✓", title: "Profile Updated", message: "Username saved successfully." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Update Failed", message: safeErrorMessage(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const payload = {
        locale,
        timezone,
        theme,
        email_notif: emailNotif,
        inapp_notif: inappNotif,
        reduce_motion: reduceMotion,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;

      await refreshLocalProfile();
      if (typeof onProfileUpdated === "function") onProfileUpdated();

      showToast({ tone: "success", icon: "✓", title: "Preferences Saved", message: "Settings updated successfully." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Save Failed", message: safeErrorMessage(err) });
    } finally {
      setSavingPrefs(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (!isImageFile(file)) {
      showToast({ tone: "warning", icon: "⚠️", title: "Invalid File", message: "Please upload an image file." });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast({ tone: "warning", icon: "⚠️", title: "File Too Large", message: "Maximum file size is 3MB." });
      return;
    }

    setAvatarBusy(true);
    try {
      const ext = extFromFile(file);
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: filePath }).eq("id", user.id);
      if (dbErr) throw dbErr;

      setAvatarUrl(filePath);
      await refreshLocalProfile();
      if (typeof onProfileUpdated === "function") onProfileUpdated();

      showToast({ tone: "success", icon: "✓", title: "Avatar Updated", message: "Profile picture uploaded successfully." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Upload Failed", message: safeErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        await supabase.storage.from("avatars").remove([avatarUrl]);
      }
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;

      setAvatarUrl("");
      await refreshLocalProfile();
      if (typeof onProfileUpdated === "function") onProfileUpdated();

      showToast({ tone: "success", icon: "✓", title: "Avatar Removed", message: "Profile picture removed." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Operation Failed", message: safeErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
    }
  };

  const sendResetPasswordEmail = async () => {
    try {
      if (!email) {
        showToast({ tone: "warning", icon: "⚠️", title: "No Email", message: "Account email is missing." });
        return;
      }

      setSendingReset(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;

      showToast({ tone: "info", icon: "📧", title: "Reset Email Sent", message: "Check your inbox for password reset link." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Request Failed", message: safeErrorMessage(err) });
    } finally {
      setSendingReset(false);
    }
  };

  const signOutOtherDevices = async () => {
    try {
      setSignOutOthersBusy(true);
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      showToast({ tone: "success", icon: "✓", title: "Sessions Terminated", message: "Signed out from other devices." });
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Operation Failed", message: safeErrorMessage(err) });
    } finally {
      setSignOutOthersBusy(false);
    }
  };

  const signOutAllDevices = async () => {
    try {
      setSignOutAllBusy(true);
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      showToast({ tone: "success", icon: "✓", title: "All Sessions Ended", message: "Redirecting to login..." });
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      showToast({ tone: "danger", icon: "✕", title: "Operation Failed", message: safeErrorMessage(err) });
    } finally {
      setSignOutAllBusy(false);
    }
  };

  const openConfirmSignoutAll = () => {
    setConfirm({
      open: true,
      intent: "signout_all",
      title: "Terminate All Sessions?",
      subtitle: "This will end all active sessions including this one. You must log in again.",
    });
  };

  const runConfirm = async () => {
    if (confirm.intent === "signout_all") {
      setConfirm({ open: false, intent: "", title: "", subtitle: "" });
      await signOutAllDevices();
      return;
    }
    setConfirm({ open: false, intent: "", title: "", subtitle: "" });
  };

  const discardPrefs = () => {
    setLocale(dbProfile?.locale || "en");
    setTimezone(dbProfile?.timezone || "Asia/Singapore");
    setTheme(dbProfile?.theme || "system");
    setEmailNotif(dbProfile?.email_notif ?? true);
    setInappNotif(dbProfile?.inapp_notif ?? true);
    setReduceMotion(dbProfile?.reduce_motion ?? false);
    showToast({ tone: "info", icon: "↩", title: "Changes Discarded", message: "Preferences reset." });
  };

  const discardProfile = () => {
    setUsername(dbProfile?.username || "");
    showToast({ tone: "info", icon: "↩", title: "Changes Reverted", message: "Draft discarded." });
  };

  /* =========================
     styles + layout
  ========================= */
  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f5f5f7", // ✅ Kanban-like background
      color: "#0f172a",
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: "relative",
      padding: "32px 24px",
    },
    container: {
      maxWidth: 1280,
      margin: "0 auto",
    },
  };

  if (loading) {
    return (
      <main style={styles.page}>
        <StyleSheet />
        <div style={styles.container}>
          <div className="_topRow">
            <div className="_crumb">Account <span>›</span> Settings</div>
          </div>
          <div className="_grid">
            <div>
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <StyleSheet />
      <Toast toast={toast} onClose={() => setToast(null)} reduceMotion={reduceMotion} />

      <Modal
        open={confirm.open}
        title={confirm.title}
        subtitle={confirm.subtitle}
        danger={true}
        reduceMotion={reduceMotion}
        onClose={() => setConfirm({ open: false, intent: "", title: "", subtitle: "" })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm({ open: false, intent: "", title: "", subtitle: "" })}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runConfirm} disabled={signOutAllBusy}>
              {signOutAllBusy ? "Processing..." : "Terminate All Sessions"}
            </Button>
          </>
        }
      >
        <div className="_muted">
          If you suspect unauthorized access, sign out all devices immediately and reset your password.
          This action cannot be undone and will require you to log in again on all devices.
        </div>
      </Modal>

      <div style={styles.container}>
        {/* TOP NAV */}
        <div className="_topRow">
          <div className="_crumb">
            <span>Account</span>
            <span>›</span>
            <span className="_crumbStrong">Settings</span>
          </div>

          <div className="_topActions">
            <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
            <Button variant="danger" onClick={doLogout} disabled={signingOut}>
              {signingOut ? "Logging out..." : "Sign Out"}
            </Button>
          </div>
        </div>

        {/* ERROR BANNER */}
        {pageError && (
          <div className="_errorBanner">
            <div>
              <div className="_errorTitle">System Error</div>
              <div className="_errorMsg">{pageError}</div>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}

        {/* HERO */}
        <div className="_hero">
          <div className="_heroLeft">
            <div className="_avatarWrap">
              <div className="_avatar">
                {avatarPublicUrl ? (
                  <img src={avatarPublicUrl} alt="Profile" className="_avatarImg" />
                ) : (
                  <span>{firstLetter}</span>
                )}
              </div>

              <label className={`_avatarOverlay ${avatarBusy ? "_disabled" : ""}`}>
                {avatarBusy ? "Uploading..." : "Change"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  disabled={avatarBusy}
                />
              </label>
            </div>

            <div className="_heroText">
              <h1 className="_heroName">{displayName}</h1>
              <div className="_heroEmail">{email || "—"}</div>
            </div>
          </div>

          <div className="_heroBadges">
            <Badge variant="primary">Supabase Auth</Badge>
            <Badge variant="success">Active</Badge>
            <Badge>Secure</Badge>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="_grid">
          {/* SIDEBAR */}
          <aside className="_sidebar">
            <div className="_sideTitle">Navigation</div>

            <button className={`_navBtn ${tab === "profile" ? "_active" : ""}`} onClick={() => setTab("profile")}>
              Profile
            </button>
            <button className={`_navBtn ${tab === "preferences" ? "_active" : ""}`} onClick={() => setTab("preferences")}>
              Preferences
            </button>
            <button className={`_navBtn ${tab === "security" ? "_active" : ""}`} onClick={() => setTab("security")}>
              Security
            </button>

            <div className="_sideDivider" />

            <div className="_sideActions">
              <Button variant="ghost" onClick={() => navigate("/organisations")}>Workspaces</Button>
              <Button variant="ghost" onClick={() => navigate("/kanban")}>Kanban Board</Button>
            </div>
          </aside>

          {/* CONTENT */}
          <div className="_content">
            {/* sticky unsaved bar */}
            {(profileDirty || prefsDirty) && (
              <div className="_stickyBar">
                <div className="_stickyText">
                  <strong>Unsaved changes</strong>
                  <span>Save or discard to keep your settings consistent.</span>
                </div>
                <div className="_stickyActions">
                  {tab === "profile" && (
                    <>
                      <Button variant="outline" onClick={discardProfile} disabled={savingProfile}>Discard</Button>
                      <Button variant="primary" onClick={saveUsername} disabled={!profileDirty || savingProfile}>
                        {savingProfile ? "Saving..." : "Save Username"}
                      </Button>
                    </>
                  )}
                  {tab === "preferences" && (
                    <>
                      <Button variant="outline" onClick={discardPrefs} disabled={savingPrefs}>Discard</Button>
                      <Button variant="primary" onClick={savePreferences} disabled={!prefsDirty || savingPrefs}>
                        {savingPrefs ? "Saving..." : "Save Preferences"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {tab === "profile" && (
              <>
                <Card
                  title="Profile Information"
                  subtitle="Your identity displayed across the system."
                  actions={<Badge variant={profileDirty ? "warning" : "success"}>{profileDirty ? "Unsaved" : "Saved"}</Badge>}
                >
                  <div className="_row">
                    <div className="_label">User ID</div>
                    <div className="_val">
                      <span>{user?.id || "—"}</span>
                      {user?.id && (
                        <button
                          className="_miniBtn"
                          onClick={async () => {
                            const ok = await copyText(user.id);
                            showToast(ok
                              ? { tone: "success", icon: "📋", title: "Copied", message: "User ID copied to clipboard." }
                              : { tone: "danger", icon: "✕", title: "Copy failed", message: "Clipboard permission blocked." }
                            );
                          }}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="_row">
                    <div className="_label">Email Address</div>
                    <div className="_val">
                      <span>{email || "—"}</span>
                      {email && (
                        <button
                          className="_miniBtn"
                          onClick={async () => {
                            const ok = await copyText(email);
                            showToast(ok
                              ? { tone: "success", icon: "📋", title: "Copied", message: "Email copied to clipboard." }
                              : { tone: "danger", icon: "✕", title: "Copy failed", message: "Clipboard permission blocked." }
                            );
                          }}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="_row _last">
                    <div className="_label">Username</div>
                    <div>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="_input"
                        placeholder="Enter your username"
                        onKeyDown={(e) => e.key === "Enter" && saveUsername()}
                        aria-label="Username"
                      />
                      <div className="_hint">Tip: Keep it short + readable (used in boards and comments).</div>
                    </div>
                  </div>

                  <div className="_btnRow">
                    <Button variant="primary" onClick={saveUsername} disabled={savingProfile || !profileDirty}>
                      {savingProfile ? "Saving..." : "Save Username"}
                    </Button>
                    <Button variant="outline" onClick={discardProfile} disabled={savingProfile || !profileDirty}>
                      Discard
                    </Button>
                  </div>
                </Card>

                <Card
                  title="Profile Picture"
                  subtitle="Upload a square image (recommended 512×512px, max 3MB)."
                  actions={<Badge variant={avatarPublicUrl ? "success" : "default"}>{avatarPublicUrl ? "Active" : "Not Set"}</Badge>}
                >
                  <div className="_btnRow">
                    <label className={`_btn _v_primary ${avatarBusy ? "_disabled" : ""}`} style={{ display: "inline-flex", gap: 10 }}>
                      {avatarBusy ? "Uploading..." : "Upload Image"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => uploadAvatar(e.target.files?.[0])}
                        disabled={avatarBusy}
                      />
                    </label>

                    <Button variant="outline" onClick={removeAvatar} disabled={avatarBusy || !avatarUrl}>
                      Remove
                    </Button>

                    <div className="_muted" style={{ marginLeft: 8 }}>
                      PNG, JPG, or WEBP format
                    </div>
                  </div>

                  <div className="_infoBox">
                    <div className="_infoTitle">Storage Information</div>
                    <div>
                      Stored in Supabase Storage under: <code>{user?.id}/avatar.[ext]</code>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* PREFERENCES TAB */}
            {tab === "preferences" && (
              <>
                <div className="_sectionHead">
                  <div>
                    <div className="_sectionTitle">User Preferences</div>
                    <div className="_sectionSub">{prefsDirty ? "You have unsaved changes." : "All preferences are saved."}</div>
                  </div>
                  <Badge variant={prefsDirty ? "warning" : "success"}>{prefsDirty ? "Unsaved" : "Saved"}</Badge>
                </div>

                <Card title="Language & Region" subtitle="Configure language and timezone settings." actions={<Badge variant="primary">Standard</Badge>}>
                  <div className="_row">
                    <div className="_label">Language</div>
                    <div>
                      <select value={locale} onChange={(e) => setLocale(e.target.value)} className="_select" aria-label="Language">
                        <option value="en">English</option>
                        <option value="zh">Chinese (中文)</option>
                        <option value="ms">Malay (Bahasa Melayu)</option>
                        <option value="ta">Tamil (தமிழ்)</option>
                      </select>
                    </div>
                  </div>

                  <div className="_row _last">
                    <div className="_label">Timezone</div>
                    <div>
                      <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="_select" aria-label="Timezone">
                        <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                        <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur (GMT+8)</option>
                        <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                        <option value="UTC">UTC (GMT+0)</option>
                      </select>
                    </div>
                  </div>
                </Card>

                <Card title="Appearance & Notifications" subtitle="Display preferences and notification settings." actions={<Badge>System</Badge>}>
                  <div className="_row">
                    <div className="_label">Theme</div>
                    <div>
                      <select value={theme} onChange={(e) => setTheme(e.target.value)} className="_select" aria-label="Theme">
                        <option value="system">System Default</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                      </select>
                    </div>
                  </div>

                  <div className="_divider" />

                  <Switch
                    checked={reduceMotion}
                    onChange={setReduceMotion}
                    label="Reduce Motion"
                    description="Minimize animations for accessibility."
                  />
                  <Switch
                    checked={inappNotif}
                    onChange={setInappNotif}
                    label="In-App Notifications"
                    description="Show alerts and updates within the application."
                  />
                  <Switch
                    checked={emailNotif}
                    onChange={setEmailNotif}
                    label="Email Notifications"
                    description="Receive important account notifications via email."
                  />

                  <div className="_btnRow">
                    <Button variant="primary" onClick={savePreferences} disabled={savingPrefs || !prefsDirty}>
                      {savingPrefs ? "Saving..." : "Save Preferences"}
                    </Button>
                    <Button variant="outline" onClick={discardPrefs} disabled={savingPrefs || !prefsDirty}>
                      Discard Changes
                    </Button>
                  </div>

                  <div className="_infoBox">
                    <div className="_infoTitle">Quality-of-life</div>
                    <div>
                      Save button is disabled until changes are detected (prevents accidental writes + cleaner audit trail).
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* SECURITY TAB */}
            {tab === "security" && (
              <>
                <Card title="Session Management" subtitle="View and control your active sessions." actions={<Badge variant="success">Active</Badge>}>
                  <div className="_row">
                    <div className="_label">Last Login</div>
                    <div className="_valOnly">{formatDateMaybe(lastSignIn)}</div>
                  </div>

                  <div className="_row _last">
                    <div className="_label">Account Created</div>
                    <div className="_valOnly">{formatDateMaybe(createdAt)}</div>
                  </div>

                  <div className="_btnRow">
                    <Button variant="outline" onClick={signOutOtherDevices} disabled={signOutOthersBusy}>
                      {signOutOthersBusy ? "Processing..." : "Sign Out Other Devices"}
                    </Button>
                    <Button variant="danger" onClick={openConfirmSignoutAll} disabled={signOutAllBusy}>
                      Terminate All Sessions
                    </Button>
                  </div>

                  <div className="_infoBox">
                    <div className="_infoTitle">Security Advisory</div>
                    <div>
                      For production: add audit logs for sign-out events + reset requests to improve traceability.
                    </div>
                  </div>
                </Card>

                <Card
                  title="Password Management"
                  subtitle="Reset your password via secure email verification."
                  actions={<Badge variant="primary">Encrypted</Badge>}
                  variant="danger"
                >
                  <div style={{ display: "grid", gap: 12 }}>
                    <Button variant="primary" onClick={sendResetPasswordEmail} disabled={sendingReset}>
                      {sendingReset ? "Sending..." : "Send Password Reset Email"}
                    </Button>
                    <div className="_muted">You’ll receive a reset link in your inbox. The link expires after 1 hour.</div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* =========================
   Styles (single place, no inline hover hacks)
   ✅ colours adjusted to match Kanban (light + purple hint)
========================= */
function StyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      :root._reduceMotion * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }

      :root{
        --bg: #f5f5f7;
        --card: #ffffff;
        --muted: #6b7280;
        --text: #0f172a;
        --border: #e2e2e2;

        /* Kanban purple hint */
        --p: #6a3df0;
        --p2:#7b5cff;
        --lav: #ebe7ff;
        --lav2:#f4f2ff;
      }

      ._topRow { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom: 22px; }
      ._crumb { display:flex; gap:10px; align-items:center; color:#6b7280; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
      ._crumb span:nth-child(2){ opacity:0.6; }
      ._crumbStrong { color:#111827; }
      ._topActions { display:flex; gap:10px; flex-wrap:wrap; }

      ._grid { display:grid; grid-template-columns: 280px 1fr; gap: 22px; align-items:start; }
      @media (max-width: 980px) { ._grid { grid-template-columns: 1fr; } }

      ._sidebar {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        box-shadow: 0 10px 28px rgba(15,23,42,0.06);
      }
      ._sideTitle {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.10em;
        color: #6b7280;
        margin: 10px 10px 12px;
      }
      ._navBtn {
        width: 100%;
        text-align: left;
        border: 1px solid transparent;
        background: transparent;
        color: #111827;
        border-radius: 12px;
        padding: 12px 12px;
        font-weight: 700;
        cursor: pointer;
        transition: transform .15s ease, background .15s ease, border-color .15s ease;
      }
      ._navBtn:hover { background: rgba(17,24,39,0.04); transform: translateY(-1px); }
      ._navBtn._active {
        border-color: rgba(106,61,240,0.28);
        background: var(--lav);
        color: var(--p);
        box-shadow: 0 10px 24px rgba(106,61,240,0.10);
      }
      ._sideDivider { height: 1px; background: rgba(226,232,240,0.95); margin: 14px 8px; }
      ._sideActions { display:grid; gap:10px; padding: 0 6px 6px; }

      ._content { display:grid; gap: 18px; }

      ._hero {
        border-radius: 22px;
        padding: 26px 28px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap: 18px;
        border: 1px solid var(--border);
        background: var(--card);
        box-shadow: 0 18px 50px rgba(15,23,42,0.06);
        margin-bottom: 18px;
      }
      ._heroLeft { display:flex; align-items:center; gap: 16px; min-width: 260px; }
      ._heroText { min-width: 0; }
      ._heroName { margin:0; font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: var(--text); }
      ._heroEmail { color: var(--muted); font-weight: 600; font-size: 14px; margin-top: 4px; }
      ._heroBadges { display:flex; gap: 10px; flex-wrap:wrap; }

      ._avatarWrap { position: relative; width: 74px; height: 74px; }
      ._avatar {
        width: 74px; height: 74px; border-radius: 999px; overflow:hidden;
        display:grid; place-items:center;
        background: linear-gradient(135deg, var(--p), var(--p2));
        border: 2px solid rgba(106,61,240,0.35);
        box-shadow: 0 12px 30px rgba(106,61,240,0.20), 0 0 0 4px rgba(106,61,240,0.08);
        font-size: 28px; font-weight: 900; color:#fff;
      }
      ._avatarImg { width:100%; height:100%; object-fit: cover; }
      ._avatarOverlay{
        position:absolute; inset:0;
        display:flex; justify-content:center; align-items:center;
        background: rgba(17,24,39,0.45);
        color:#fff;
        font-weight: 800;
        border-radius: 999px;
        opacity: 0;
        cursor: pointer;
        transition: opacity .18s ease;
        user-select:none;
      }
      ._avatarWrap:hover ._avatarOverlay { opacity: 1; }
      ._avatarOverlay._disabled { opacity: 0.6; cursor: not-allowed; }

      ._card {
        border-radius: 16px;
        overflow:hidden;
        border: 1px solid var(--border);
        background: var(--card);
        box-shadow: 0 10px 30px rgba(15,23,42,0.06);
      }
      ._cardHeader{
        padding: 16px 20px;
        display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;
        background: linear-gradient(135deg, #fafafa, #ffffff);
        border-bottom: 1px solid rgba(226,232,240,0.95);
      }
      ._cardHeader._danger{
        background: linear-gradient(135deg, #fff1f2, #ffffff);
      }
      ._cardTitle{ font-weight: 900; color: var(--text); font-size: 16px; letter-spacing: -0.02em; }
      ._cardSub{ margin-top: 4px; color: #6b7280; font-weight: 600; font-size: 13px; line-height: 1.4; }
      ._cardBody{ padding: 20px; }

      ._row{
        display:grid; grid-template-columns: 180px 1fr; gap: 14px;
        padding: 14px 0;
        border-bottom: 1px solid rgba(226,232,240,0.85);
        align-items:center;
      }
      ._row._last { border-bottom: none; }
      @media (max-width: 680px){ ._row{ grid-template-columns: 1fr; } }
      ._label{ color:#4b5563; font-weight: 800; font-size: 13px; }
      ._val{ display:flex; align-items:center; gap: 10px; flex-wrap:wrap; color: var(--text); font-weight: 650; }
      ._valOnly{ color: var(--text); font-weight: 650; }
      ._hint{ margin-top: 8px; color:#6b7280; font-weight: 600; font-size: 12.5px; }

      ._input, ._select{
        width: 100%;
        max-width: 560px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(203,213,225,0.95);
        background: #fff;
        outline: none;
        color: var(--text);
        font-weight: 650;
        font-size: 14px;
        transition: box-shadow .15s ease, border-color .15s ease, transform .15s ease;
      }
      ._select { max-width: 420px; cursor: pointer; }
      ._input:focus, ._select:focus{
        border-color: rgba(106,61,240,0.65);
        box-shadow: 0 0 0 4px rgba(106,61,240,0.14);
      }

      ._btnRow { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; align-items:center; }

      ._btn{
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 12px;
        padding: 11px 16px;
        font-weight: 800;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
        display:inline-flex; align-items:center; justify-content:center;
        user-select:none;
      }
      ._btn:disabled{ opacity: 0.6; cursor: not-allowed; transform:none !important; }
      ._v_ghost { background: rgba(106,61,240,0.08); color: var(--p); border-color: rgba(106,61,240,0.18); }
      ._v_ghost:hover { background: rgba(106,61,240,0.12); transform: translateY(-1px); }

      ._v_primary{
        background: linear-gradient(135deg, var(--p), var(--p2));
        border-color: rgba(106,61,240,0.25);
        color:#fff;
        box-shadow: 0 10px 26px rgba(106,61,240,0.20);
      }
      ._v_primary:hover{ transform: translateY(-1px); box-shadow: 0 14px 34px rgba(106,61,240,0.26); }

      ._v_outline{
        background:#fff;
        border-color: rgba(203,213,225,0.95);
        color:#334155;
      }
      ._v_outline:hover{ transform: translateY(-1px); box-shadow: 0 10px 26px rgba(15,23,42,0.06); }

      ._v_danger{
        background: linear-gradient(135deg, #ef4444, #dc2626);
        border-color: rgba(255,255,255,0.20);
        color:#fff;
        box-shadow: 0 10px 26px rgba(239,68,68,0.18);
      }
      ._v_danger:hover{ transform: translateY(-1px); box-shadow: 0 14px 34px rgba(239,68,68,0.24); }

      ._disabled{ opacity:0.6; cursor:not-allowed; }

      ._miniBtn{
        border: 1px solid rgba(203,213,225,0.95);
        background:#fff;
        color:#334155;
        border-radius: 999px;
        padding: 6px 10px;
        font-weight: 800;
        cursor:pointer;
        font-size: 12px;
        transition: transform .12s ease, box-shadow .12s ease;
      }
      ._miniBtn:hover{ transform: translateY(-1px); box-shadow: 0 10px 20px rgba(15,23,42,0.06); }

      ._badge{
        display:inline-flex;
        align-items:center;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid rgba(148,163,184,0.20);
        background: linear-gradient(135deg, #eef2ff, #f5f3ff);
        color:#4b5563;
        box-shadow: 0 8px 18px rgba(15,23,42,0.05);
      }
      ._b_primary{ background: linear-gradient(135deg, var(--p), var(--p2)); color:#fff; border-color: rgba(106,61,240,0.22); }
      ._b_success{ background: linear-gradient(135deg, #10b981, #059669); color:#fff; border-color: rgba(16,185,129,0.22); }
      ._b_warning{ background: linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border-color: rgba(245,158,11,0.22); }
      ._b_danger{ background: linear-gradient(135deg, #ef4444, #dc2626); color:#fff; border-color: rgba(239,68,68,0.22); }

      ._divider { height: 1px; background: rgba(226,232,240,0.85); margin: 14px 0; }

      ._infoBox{
        margin-top: 16px;
        border-radius: 14px;
        border: 1px solid rgba(106,61,240,0.18);
        background: linear-gradient(135deg, var(--lav2), rgba(106,61,240,0.05));
        padding: 14px;
        color:#334155;
        font-weight: 650;
        line-height: 1.5;
        font-size: 13px;
      }
      ._infoTitle{ font-weight: 900; margin-bottom: 6px; color: var(--text); }

      ._errorBanner{
        display:flex; justify-content:space-between; gap: 14px; align-items:flex-start;
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid rgba(239,68,68,0.22);
        background: linear-gradient(135deg, rgba(239,68,68,0.10), rgba(220,38,38,0.05));
        color:#7f1d1d;
        margin-bottom: 18px;
      }
      ._errorTitle{ font-weight: 900; color:#7f1d1d; margin-bottom: 4px; }
      ._errorMsg{ color:#991b1b; font-weight: 700; }

      ._sectionHead{ display:flex; justify-content:space-between; align-items:flex-end; gap: 12px; flex-wrap:wrap; margin-top: 4px; }
      ._sectionTitle{ color: var(--text); font-weight: 900; font-size: 18px; letter-spacing: -0.02em; }
      ._sectionSub{ color: #6b7280; font-weight: 700; font-size: 13px; margin-top: 4px; }

      ._stickyBar{
        position: sticky;
        top: 18px;
        z-index: 5;
        border-radius: 16px;
        border: 1px solid rgba(106,61,240,0.18);
        background: linear-gradient(135deg, var(--lav2), rgba(106,61,240,0.06));
        box-shadow: 0 18px 50px rgba(15,23,42,0.08);
        padding: 14px 14px;
        display:flex; justify-content:space-between; align-items:center; gap: 14px; flex-wrap:wrap;
      }
      ._stickyText{ display:flex; flex-direction:column; gap: 2px; color: var(--text); }
      ._stickyText strong{ font-weight: 900; letter-spacing: -0.01em; }
      ._stickyText span{ color:#4b5563; font-weight: 700; font-size: 13px; }
      ._stickyActions{ display:flex; gap: 10px; flex-wrap:wrap; }

      ._muted{ color:#6b7280; font-weight: 650; font-size: 13px; line-height: 1.5; }
      code{ background: rgba(17,24,39,0.06); padding: 2px 6px; border-radius: 8px; }

      /* Switch */
      ._switchRow{
        display:flex; justify-content:space-between; gap: 14px; align-items:flex-start;
        padding: 12px 0;
        border-bottom: 1px solid rgba(226,232,240,0.85);
      }
      ._switchLabel{ font-weight: 900; font-size: 14px; color: var(--text); }
      ._switchDesc{ color:#6b7280; font-weight: 650; font-size: 13px; margin-top: 4px; line-height: 1.4; }
      ._switch{
        width: 48px; height: 28px; border-radius: 999px;
        border: 1px solid rgba(203,213,225,0.95);
        background: linear-gradient(135deg, #e5e7eb, #d1d5db);
        position: relative;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
        flex: 0 0 auto;
      }
      ._switch._on{
        background: linear-gradient(135deg, var(--p), var(--p2));
        box-shadow: 0 10px 24px rgba(106,61,240,0.20);
      }
      ._switchKnob{
        position:absolute;
        top: 3px; left: 3px;
        width: 22px; height: 22px;
        border-radius: 999px;
        background:#fff;
        box-shadow: 0 8px 18px rgba(15,23,42,0.16);
        transition: left .18s ease;
      }
      ._switch._on ._switchKnob{ left: 23px; }
      ._switch:disabled{ opacity: 0.6; cursor:not-allowed; }

      /* Toast */
      ._toast{
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 9999;
        width: min(420px, calc(100vw - 48px));
        padding: 16px 16px;
        border-radius: 14px;
        box-shadow: 0 24px 64px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06);
        backdrop-filter: blur(16px);
        display:flex;
        gap: 12px;
        align-items:flex-start;
        animation: toastIn .28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      ._toast._rm{ animation:none; }
      @keyframes toastIn{
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      ._toastIcon{ font-size: 20px; line-height: 20px; }
      ._toastTitle{ font-weight: 900; font-size: 14px; letter-spacing: -0.01em; margin-bottom: 2px; }
      ._toastMsg{ opacity: 0.92; font-size: 13px; line-height: 1.45; font-weight: 650; word-break: break-word; }
      ._iconBtn{
        border:none;
        background: transparent;
        cursor:pointer;
        font-weight: 900;
        padding: 6px;
        margin: -6px;
        border-radius: 10px;
      }
      ._toastClose{ color: currentColor; opacity: 0.85; }
      ._toastClose:hover{ background: rgba(17,24,39,0.06); opacity: 1; }
      ._modalClose{ color: rgba(17,24,39,0.70); }
      ._modalClose:hover{ background: rgba(17,24,39,0.06); }

      /* Modal */
      ._modalBackdrop{
        position: fixed; inset:0; z-index: 9000;
        background: rgba(17,24,39,0.45);
        backdrop-filter: blur(8px);
        display:grid;
        place-items:center;
        padding: 20px;
        animation: fadeIn .18s ease;
      }
      ._modalBackdrop._rm{ animation:none; }
      @keyframes fadeIn{ from{opacity:0} to{opacity:1} }
      ._modal{
        width: min(560px, 100%);
        border-radius: 16px;
        background:#fff;
        border: 1px solid rgba(226,232,240,0.75);
        box-shadow: 0 32px 96px rgba(15,23,42,0.20);
        overflow:hidden;
        animation: popIn .22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      ._modalBackdrop._rm ._modal{ animation:none; }
      @keyframes popIn{ from{transform: scale(0.94) translateY(18px); opacity:0} to{transform:none; opacity:1} }
      ._modalHeader{
        padding: 18px 20px;
        display:flex; justify-content:space-between; align-items:flex-start; gap: 14px;
        border-bottom: 1px solid rgba(226,232,240,0.9);
        background: linear-gradient(135deg, #fafafa, #ffffff);
      }
      ._modalHeader._danger{ background: linear-gradient(135deg, #fff1f2, #ffffff); }
      ._modalTitle{ font-weight: 900; font-size: 17px; color: var(--text); letter-spacing: -0.02em; }
      ._modalSub{ font-weight: 700; font-size: 13px; color:#dc2626; margin-top: 4px; }
      ._modalBody{ padding: 20px; }
      ._modalFooter{
        padding: 14px 20px;
        border-top: 1px solid rgba(226,232,240,0.9);
        display:flex; justify-content:flex-end; gap: 10px; flex-wrap:wrap;
        background:#fafafa;
      }

      /* Skeleton */
      ._skCard{
        border-radius: 16px;
        border: 1px solid rgba(226,232,240,0.95);
        background: #ffffff;
        padding: 18px;
        margin-bottom: 14px;
        overflow:hidden;
        position: relative;
        box-shadow: 0 10px 26px rgba(15,23,42,0.05);
      }
      ._skCard:before{
        content:"";
        position:absolute;
        inset:-40px;
        background: linear-gradient(90deg, transparent, rgba(106,61,240,0.10), transparent);
        transform: translateX(-60%);
        animation: shimmer 1.2s infinite;
      }
      :root._reduceMotion ._skCard:before{ animation:none; }
      @keyframes shimmer{ to{ transform: translateX(60%); } }
      ._skLine{
        height: 12px;
        border-radius: 999px;
        background: rgba(17,24,39,0.06);
        margin: 10px 0;
      }
      ._w60{ width: 60%; }
      ._w70{ width: 70%; }
      ._w90{ width: 90%; }
    `}</style>
  );
}
