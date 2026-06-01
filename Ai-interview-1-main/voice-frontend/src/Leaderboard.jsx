import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

export default function Leaderboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadLeaderboard() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/api/leaderboard`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load leaderboard");
      }

      setItems(data.leaderboard || []);
    } catch (e) {
      alert("Leaderboard error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="leaderboard-card">
      <div className="iv-header">
        <div>
          <h2 className="iv-title">🏆 Score Leaderboard</h2>
          <div className="iv-sub">
            Top candidates based on interview scores.
          </div>
        </div>

        <button
          className="ai-btn ai-btn-primary"
          onClick={loadLeaderboard}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="ai-muted mt-2">Loading leaderboard...</div>
      ) : items.length === 0 ? (
        <div className="ai-muted mt-2">No scores available yet.</div>
      ) : (
        <div className="leader-list">
          {items.map((item, index) => (
            <div key={item.id} className="leader-row">
              <div className="leader-rank">
                {index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : index === 2
                  ? "🥉"
                  : `#${index + 1}`}
              </div>

              <div className="leader-user">
                <strong>{item.name || "User"}</strong>
                <span>{item.email}</span>
              </div>

              <div className="leader-score">{item.score}/10</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}