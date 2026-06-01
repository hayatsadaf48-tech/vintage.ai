import { useEffect, useState } from "react";
import Interview from "./Interview";
import Attempts from "./Attempts";
import Home from "./Home";
import Auth from "./Auth";
import Payment from "./Payment";
import Leaderboard from "./Leaderboard";
import DashboardStats from "./DashboardStats";

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

    async function checkAuth() {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          credentials: "include",
        });

        const data = await safeJson(res);

        if (!alive) return;

        if (res.ok && data.loggedIn) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        if (!alive) return;
        setUser(null);
      } finally {
        if (alive) setChecking(false);
      }
    }

    checkAuth();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => setPage("payment-success");
    window.addEventListener("payment-success", handler);

    return () => {
      window.removeEventListener("payment-success", handler);
    };
  }, []);

  useEffect(() => {
    const handler = () => setPage("payment");
    window.addEventListener("open-payment", handler);

    return () => {
      window.removeEventListener("open-payment", handler);
    };
  }, []);

  function go(to) {
    if (
      (to === "interview" ||
        to === "attempts" ||
        to === "payment" ||
        to === "leaderboard") &&
      !user
    ) {
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
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    setUser(null);
    setPage("home");
  }

  function renderPage() {
    if (checking) {
      return (
        <div className="ai-card" style={{ marginTop: 20 }}>
          Loading...
        </div>
      );
    }

    if (page === "home") {
      return (
        <>
          {user && <DashboardStats />}

          <Home
            user={user}
            onStart={() => go("interview")}
            onLogin={() => go("auth")}
          />
        </>
      );
    }

    if (page === "auth") {
      return (
        <Auth
          apiBase={API}
          onAuthed={onAuthed}
          onBack={() => setPage("home")}
        />
      );
    }

    if (page === "interview") {
      return <Interview />;
    }

    if (page === "attempts") {
      return <Attempts />;
    }

    if (page === "leaderboard") {
      return <Leaderboard />;
    }

    if (page === "payment") {
      return <Payment />;
    }

    if (page === "payment-success") {
      return (
        <div className="ai-card" style={{ marginTop: 20, textAlign: "center" }}>
          <h1>Payment Successful ✅</h1>
          <p>Premium Interview Plan Activated.</p>

          <button
            className="ai-btn ai-btn-primary"
            onClick={() => go("interview")}
          >
            Start Premium Interview
          </button>
        </div>
      );
    }

    return (
      <Home
        user={user}
        onStart={() => go("interview")}
        onLogin={() => go("auth")}
      />
    );
  }

  return (
    <div className="ai-shell">
      <header className="ai-topbar">
        <div className="ai-userbox">
          <div className="ai-name">
            {user ? (
              <>
                {user.name}
                {user.isPremium && (
                  <span className="premium-badge">👑 Premium</span>
                )}
              </>
            ) : (
              "Interview.AI"
            )}
          </div>

          <div className="ai-email">
            {user ? user.email : "Practice interviews with voice + STT + PDF"}
          </div>
        </div>

        <div className="ai-nav">
          <button
            className={`ai-tab ${page === "home" ? "active" : ""}`}
            onClick={() => go("home")}
          >
            Home
          </button>

          <button
            className={`ai-tab ${page === "interview" ? "active" : ""}`}
            onClick={() => go("interview")}
          >
            Start Interview
          </button>

          {user && (
            <button
              className={`ai-tab ${page === "attempts" ? "active" : ""}`}
              onClick={() => go("attempts")}
            >
              Attempts
            </button>
          )}

          {user && (
            <button
              className={`ai-tab ${page === "leaderboard" ? "active" : ""}`}
              onClick={() => go("leaderboard")}
            >
              🏆 Leaderboard
            </button>
          )}

          {user && (
            <button
              className={`ai-tab ${page === "payment" ? "active" : ""}`}
              onClick={() => go("payment")}
            >
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

      <div className="ai-container">{renderPage()}</div>
    </div>
  );
}