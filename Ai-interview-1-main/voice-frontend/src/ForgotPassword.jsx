import { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      alert("OTP generated. Check email or Render logs.");
      setStep(2);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          otp,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password reset failed");

      alert("Password reset successfully. Please login.");
      onBack();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-center" style={{ minHeight: "70vh" }}>
      <div className="ai-card" style={{ maxWidth: "450px", width: "100%" }}>
        <h2 className="iv-title">Forgot Password</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div className="text-left">
            <label className="iv-label">EMAIL ADDRESS</label>
            <input
              className="ai-input"
              placeholder="Enter registered email"
              value={email}
              disabled={step === 2}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {step === 2 && (
            <>
              <div className="text-left">
                <label className="iv-label">OTP CODE</label>
                <input
                  className="ai-input"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>

              <div className="text-left">
                <label className="iv-label">NEW PASSWORD</label>
                <input
                  className="ai-input"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 1 ? (
            <button
              className="ai-btn ai-btn-primary"
              onClick={sendOtp}
              disabled={loading || !email.trim()}
              style={{ width: "100%", padding: "15px" }}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          ) : (
            <button
              className="ai-btn ai-btn-primary"
              onClick={resetPassword}
              disabled={loading || !otp.trim() || !newPassword.trim()}
              style={{ width: "100%", padding: "15px" }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          )}

          <button className="ai-btn" onClick={onBack}>
            Back to Login
          </button>
        </div>

        {step === 2 && (
          <div className="ai-muted mt-2" style={{ fontSize: "12px" }}>
            OTP email na aaye to Render Logs me <b>DEMO OTP</b> check karo.
          </div>
        )}
      </div>
    </div>
  );
}