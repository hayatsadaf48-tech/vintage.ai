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
  const [showVerifyOtp, setShowVerifyOtp] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);

      const cleanEmail = email.toLowerCase().trim();

      const url =
        mode === "login"
          ? `${apiBase}/api/auth/login`
          : `${apiBase}/api/auth/register`;

      const payload =
        mode === "login"
          ? { email: cleanEmail, password }
          : { name, email: cleanEmail, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || "Auth failed");
      }

      if (mode === "register" && data.needVerification) {
        alert("OTP sent to your email");
        setShowVerifyOtp(true);
        return;
      }

      onAuthed?.(data.user);
    } catch (e) {
      alert((mode === "login" ? "Login" : "Register") + " error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegisterOtp() {
    try {
      setVerifyLoading(true);

      const cleanEmail = email.toLowerCase().trim();

      if (!otp.trim()) {
        alert("Please enter OTP");
        return;
      }

      const res = await fetch(`${apiBase}/api/auth/verify-register-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: cleanEmail,
          otp: otp.trim(),
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || "OTP verification failed");
      }

      alert("Email verified successfully");
      onAuthed?.(data.user);
    } catch (e) {
      alert(e.message);
    } finally {
      setVerifyLoading(false);
    }
  }

  if (showForgot) {
    return <ForgotPassword onBack={() => setShowForgot(false)} />;
  }

  if (showVerifyOtp) {
    return (
      <div className="flex-center" style={{ minHeight: "70vh" }}>
        <div className="ai-card" style={{ maxWidth: "450px", width: "100%" }}>
          <div className="iv-header">
            <h2 className="iv-title">Verify Your Email</h2>

            <button
              className="ai-btn ai-btn-danger"
              style={{ padding: "5px 12px" }}
              onClick={() => setShowVerifyOtp(false)}
            >
              ✖
            </button>
          </div>

          <p className="ai-muted" style={{ marginBottom: "20px" }}>
            We sent a 6-digit OTP to:
            <br />
            <b>{email}</b>
          </p>

          <div className="text-left">
            <label className="iv-label">ENTER OTP</label>
            <input
              className="ai-input"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>

          <button
            className="ai-btn ai-btn-primary"
            style={{ width: "100%", padding: "15px", marginTop: "15px" }}
            onClick={verifyRegisterOtp}
            disabled={verifyLoading}
          >
            {verifyLoading ? "Verifying..." : "Verify OTP"}
          </button>

          <button
            className="ai-btn"
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "10px",
              background: "#f1f5f9",
              color: "#334155",
            }}
            onClick={() => {
              setShowVerifyOtp(false);
              setMode("register");
            }}
          >
            Back to Register
          </button>
        </div>
      </div>
    );
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
