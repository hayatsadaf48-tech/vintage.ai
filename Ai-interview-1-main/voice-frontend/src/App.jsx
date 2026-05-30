import { useEffect, useState } from "react";
import Interview from "./Interview";
import Attempts from "./Attempts";
import Home from "./Home";
import Auth from "./Auth";
import Payment from "./Payment";

const API = import.meta.env.VITE_API_BASE || "";

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  const [page, setPage] = useState("home");
  const [redirectAfterAuth, setRedirectAfterAuth] = useState("home");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        const data = await safeJson(res);
        if (!alive) return;
        if (res.ok && data.loggedIn) setUser(data.user);
        else setUser(null);
      } catch {
        if (!alive) return;
        setUser(null);
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => setPage("payment-success");
    window.addEventListener("payment-success", handler);
    return () => window.removeEventListener("payment-success", handler);
  }, []);

  function go(to) {
    if ((to === "interview" || to === "attempts" || to === "payment") && !user) {
      setRedirectAfterAuth(to);
      setPage("auth");
      return;
    }
    setPage(to);
  }

  function onAuthed(u) {
    setUser(u);
    setPage(redirectAfterAuth || "home");
    setRedirectAfterAuth("home");
  }

  async function logout() {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
    setPage("home");
  }

  return (
    <div className="ai-shell">
      <header className="ai-topbar">
        <div className="ai-userbox">
          <div className="ai-name">{user ? user.name : "Interview.AI"}</div>
          <div className="ai-email">
            {user ? user.email : "Practice interviews with voice + STT + PDF"}
          </div>
        </div>

        <div className="ai-nav">
          <button className={`ai-tab ${page === "home" ? "active" : ""}`} onClick={() => go("home")}>
            Home
          </button>

          <button className={`ai-tab ${page === "interview" ? "active" : ""}`} onClick={() => go("interview")}>
            Start Interview
          </button>

          {user && (
            <button className={`ai-tab ${page === "attempts" ? "active" : ""}`} onClick={() => go("attempts")}>
              Attempts
            </button>
          )}

          {user && (
            <button className={`ai-tab ${page === "payment" ? "active" : ""}`} onClick={() => go("payment")}>
              Premium
            </button>
          )}

          {!user ? (
            <button className="ai-btn ai-btn-primary" onClick={() => go("auth")}>
              Login
            </button>
          ) : (
            <button className="ai-btn ai-btn-danger" onClick={logout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <div className="ai-container">
        {checking ? (
          <div className="ai-card" style={{ marginTop: 20 }}>Loading...</div>
        ) : page === "home" ? (
          <Home user={user} onStart={() => go("interview")} onLogin={() => go("auth")} />
        ) : page === "auth" ? (
          <Auth apiBase={API} onAuthed={onAuthed} onBack={() => setPage("home")} />
        ) : page === "interview" ? (
          <Interview />
        ) : page === "attempts" ? (
          <Attempts />
        ) : page === "payment" ? (
          <Payment />
        ) : page === "payment-success" ? (
          <div className="ai-card" style={{ marginTop: 20, textAlign: "center" }}>
            <h1>Payment Successful ✅</h1>
            <p>Premium Interview Plan Activated.</p>
            <button className="ai-btn ai-btn-primary" onClick={() => go("interview")}>
              Start Premium Interview
            </button>
          </div>
        ) : (
          <Home user={user} onStart={() => go("interview")} onLogin={() => go("auth")} />
        )}
      </div>
    </div>
  );
}
