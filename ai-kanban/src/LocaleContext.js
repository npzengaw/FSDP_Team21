// src/LocaleContext.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { translate } from "./i18n";

const LocaleContext = createContext(null);

export function LocaleProvider({ profile, children }) {
  // Initialize with fallback chain: profile → localStorage → default
  const [locale, setLocale] = useState(() => {
    return profile?.locale || localStorage.getItem("kiro_locale") || "en";
  });

  const [timezone, setTimezone] = useState(() => {
    return profile?.timezone || localStorage.getItem("kiro_timezone") || "Asia/Singapore";
  });

  // ✅ Track last applied profile values so we don't overwrite user's manual changes
  const lastProfileLocaleRef = useRef(profile?.locale ?? null);
  const lastProfileTimezoneRef = useRef(profile?.timezone ?? null);

  // ✅ Sync ONLY when profile values actually change (not when user changes locale/timezone)
  useEffect(() => {
    if (!profile) return;

    // Only apply if profile.locale truly changed since last time we applied it
    if (
      profile.locale &&
      profile.locale !== lastProfileLocaleRef.current
    ) {
      lastProfileLocaleRef.current = profile.locale;
      setLocale(profile.locale);
    }

    // Only apply if profile.timezone truly changed since last time we applied it
    if (
      profile.timezone &&
      profile.timezone !== lastProfileTimezoneRef.current
    ) {
      lastProfileTimezoneRef.current = profile.timezone;
      setTimezone(profile.timezone);
    }
  }, [profile]);

  // Persist locale changes to localStorage and update document language
  useEffect(() => {
    localStorage.setItem("kiro_locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  // Persist timezone changes to localStorage
  useEffect(() => {
    localStorage.setItem("kiro_timezone", timezone);
  }, [timezone]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => {
    const t = (key) => translate(locale, key);

    return {
      locale,
      setLocale,
      timezone,
      setTimezone,
      t,
    };
  }, [locale, timezone]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
