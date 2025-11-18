import React, { useState, useEffect } from "react";
import "./LoginPage.css";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

// ================================
// ✅ Updated Kanban-focused slides
// ================================
const slides = [
  {
    img: "/kanban1.svg",
    title: "Visualize Your Workflow",
    desc: "Kanban boards help you see tasks clearly across every stage.",
  },
  {
    img: "/kanban1.svg",
    title: "Stay Organized",
    desc: "Columns and cards let you structure work your way.",
  },
  {
    img: "/kanban1.svg",
    title: "Track Progress Easily",
    desc: "See progress move from left to right with clarity.",
  },
];


function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    (localStorage.getItem("theme") || "dark") === "dark"
  );
  const [slideIndex, setSlideIndex] = useState(0);

  // Theme handling
  useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [darkMode]);

  // Auto slideshow
  useEffect(() => {
    const interval = setInterval(
      () => setSlideIndex((prev) => (prev + 1) % slides.length),
      4500
    );
    return () => clearInterval(interval);
  }, []);

  // Login Logic
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate("/organisations");
  };

  return (
    <div className="auth-wrapper">
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      {/* Theme Toggle */}
      <button
        className="theme-toggle"
        onClick={() => setDarkMode((v) => !v)}
        aria-label="Toggle theme"
      >
        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>

      <div className="auth-card hover-float">
        {/* Left: Login */}
        <div className="auth-left">
          <h1 className="brand">Kiro</h1>
          <p className="subtitle">Sign in to your workspace</p>

          <form onSubmit={handleSubmit} className="form">
            <label className="label">
              <span>Email</span>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="label">
              <span>Password</span>
              <div className="password">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>

            <div className="divider">or</div>

            <Link to="/signup" className="btn btn--outline">
              Create Account
            </Link>
          </form>
        </div>

        {/* Right: Slideshow */}
        <div className="auth-right">
          {slides.map((slide, i) => (
            <div key={i} className={`slide ${i === slideIndex ? "active" : ""}`}>
              <img src={slide.img} alt={slide.title} />
              <h2>{slide.title}</h2>
              <p>{slide.desc}</p>
            </div>
          ))}

          <div className="dots">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`dot ${i === slideIndex ? "active" : ""}`}
              ></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
