import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

export default function DashboardStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`${API}/api/dashboard-stats`, {
          credentials: "include",
        });

        const data = await res.json();

        if (res.ok) {
          setStats(data);
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadStats();
  }, []);

  if (!stats) return null;

  return (
    <div className="dash-stats">
      <div className="dash-card">
        <span>📄</span>
        <strong>{stats.totalInterviews}</strong>
        <p>Total Interviews</p>
      </div>

      <div className="dash-card">
        <span>⭐</span>
        <strong>{stats.averageScore}/10</strong>
        <p>Average Score</p>
      </div>

      <div className="dash-card">
        <span>🏆</span>
        <strong>{stats.bestScore}/10</strong>
        <p>Best Score</p>
      </div>

      <div className="dash-card">
        <span>💎</span>
        <strong>{stats.isPremium ? "Premium" : "Free"}</strong>
        <p>Plan Status</p>
      </div>
    </div>
  );
}