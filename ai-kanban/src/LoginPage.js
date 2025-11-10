import React, { useState } from "react";
import "./LoginPage.css";

function LoginPage({ onLogin, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignup = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    try {
      await onSignup(email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="login-page-root">
        <div className="auth-layout">
          {/* LEFT PANEL */}
          <div className="auth-left">
            <div className="left-content">
              <div className="brand">AI Kanban</div>
              <div className="left-sub">Welcome back</div>
              <div className="left-title">Sign in to your workspace</div>

              <form onSubmit={handleSubmit} className="left-form">
                <div className="field">
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    className="field-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label className="field-label">Password</label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="primary">
                  Log In
                </button>

                <div className="divider">or</div>

                <button type="button" onClick={handleSignup} className="primary">
                  Create Account
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT PANEL (illustration / slideshow) */}
          <div className="auth-right">
            <div className="art">
              <div className="slideshow">
                {[1, 2, 3].map((num, i) => (
                  <div
                    key={i}
                    className={`slide ${slideIndex === i ? "active" : ""}`}
                  >
                    <img
                      src={`https://source.unsplash.com/collection/190727/${500 + i}x400`}
                      alt={`slide-${i}`}
                      style={{ borderRadius: "16px", width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
                <div className="slideshow-dots">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      className={`dot ${slideIndex === i ? "active" : ""}`}
                      onClick={() => setSlideIndex(i)}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="keyboard-shortcut">
          <kbd>Ctrl</kbd> + <kbd>L</kbd> <span>to login faster</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
