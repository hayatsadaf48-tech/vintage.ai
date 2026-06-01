import { useState } from "react";
import ForgotPassword from "./ForgotPassword";

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

export default function Auth({ apiBase, onAuthed, onBack }) {
  const [mode, setMode] = useState("login");
  const [showForgot, setShowForgot] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      const url =
        mode === "login"
          ? `${apiBase}/api/auth/login`
          : `${apiBase}/api/auth/register`;

      const payload =
        mode === "login" ? { email, password } : { name, email, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Auth failed");
      onAuthed?.(data.user);
    } catch (e) {
      alert((mode === "login" ? "Login" : "Register") + " error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  if (showForgot) {
    return <ForgotPassword onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="flex-center" style={{ minHeight: "70vh" }}>
      <div className="ai-card" style={{ maxWidth: "450px", width: "100%" }}>
        <div className="iv-header">
          <h2 className="iv-title">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>

          {onBack && (
            <button
              className="ai-btn ai-btn-danger"
              style={{ padding: "5px 12px" }}
              onClick={onBack}
            >
              ✖
            </button>
          )}
        </div>

        <div
          className="ai-nav"
          style={{
            justifyContent: "center",
            marginBottom: "25px",
            background: "#f1f5f9",
            padding: "5px",
            borderRadius: "50px",
          }}
        >
          <button
            className={`ai-btn ${mode === "login" ? "ai-btn-primary" : ""}`}
            style={{
              flex: 1,
              background: mode !== "login" ? "transparent" : "",
              color: mode !== "login" ? "#64748b" : "",
            }}
            onClick={() => setMode("login")}
          >
            Login
          </button>

          <button
            className={`ai-btn ${mode === "register" ? "ai-btn-primary" : ""}`}
            style={{
              flex: 1,
              background: mode !== "register" ? "transparent" : "",
              color: mode !== "register" ? "#64748b" : "",
            }}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {mode === "register" && (
            <div className="text-left">
              <label className="iv-label">FULL NAME</label>
              <input
                className="ai-input"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="text-left">
            <label className="iv-label">EMAIL ADDRESS</label>
            <input
              className="ai-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="text-left">
            <label className="iv-label">PASSWORD</label>
            <input
              className="ai-input"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                textAlign: "right",
                fontWeight: 600,
              }}
            >
              Forgot Password?
            </button>
          )}

          <button
            className="ai-btn ai-btn-primary"
            style={{ width: "100%", padding: "15px", marginTop: "10px" }}
            onClick={submit}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : mode === "login"
              ? "Sign In"
              : "Register Now"}
          </button>
        </div>

        <div className="ai-muted mt-2" style={{ fontSize: "12px" }}>
          🔐 Secure login enabled. Protected routes like TTS, PDF Upload, and
          Evaluation require authentication.
        </div>
      </div>
    </div>
  );
}
