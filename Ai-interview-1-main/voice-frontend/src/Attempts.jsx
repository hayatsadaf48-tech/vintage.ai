import { useEffect, useState } from "react";
import jsPDF from "jspdf";

const API = import.meta.env.VITE_API_BASE || "";

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

export default function Attempts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/attempts`, { credentials: "include" });
      const data = await safeJson(res);

      if (res.status === 401 || res.status === 403) {
        throw new Error("Not logged in / session missing. Pehle login karo.");
      }
      if (!res.ok) throw new Error(data.error || "Failed to load attempts");
      setItems(data.attempts || []);
    } catch (e) {
      alert("Load attempts error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    const ok = confirm("Delete this attempt?");
    if (!ok) return;

    try {
      setBusyId(id);
      const res = await fetch(`${API}/api/attempt/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await safeJson(res);

      if (res.status === 401 || res.status === 403) {
        throw new Error("Not logged in / session missing. Pehle login karo.");
      }
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setItems((prev) => prev.filter((x) => x._id !== id));
    } catch (e) {
      alert("Delete error: " + e.message);
    } finally {
      setBusyId("");
    }
  }

  function downloadReport(a) {
    const doc = new jsPDF();

    const date = a.createdAt ? new Date(a.createdAt).toLocaleString() : "N/A";
    const score = a.score ?? "N/A";

    doc.setFontSize(18);
    doc.text("AI Interview Report", 14, 18);

    doc.setFontSize(11);
    doc.text(`Date: ${date}`, 14, 30);
    doc.text(`Score: ${score}/10`, 14, 38);
    doc.text(`Voice ID: ${a.voiceId || "N/A"}`, 14, 46);

    doc.setFontSize(14);
    doc.text("Question", 14, 60);

    doc.setFontSize(11);
    const questionLines = doc.splitTextToSize(a.question || "N/A", 180);
    doc.text(questionLines, 14, 70);

    let y = 70 + questionLines.length * 7 + 8;

    doc.setFontSize(14);
    doc.text("Candidate Answer", 14, y);
    y += 10;

    doc.setFontSize(11);
    const answerLines = doc.splitTextToSize(a.answerText || "No answer saved", 180);
    doc.text(answerLines, 14, y);

    y += answerLines.length * 7 + 8;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text("AI Feedback", 14, y);
    y += 10;

    doc.setFontSize(11);
    const feedbackLines = doc.splitTextToSize(a.feedback || "No feedback saved", 180);
    doc.text(feedbackLines, 14, y);

    y += feedbackLines.length * 7 + 8;

    if (a.what_was_good?.length) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.text("What Was Good", 14, y);
      y += 10;

      doc.setFontSize(11);
      a.what_was_good.forEach((item) => {
        const lines = doc.splitTextToSize(`- ${item}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 7;
      });
    }

    if (a.what_to_improve?.length) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.text("What To Improve", 14, y);
      y += 10;

      doc.setFontSize(11);
      a.what_to_improve.forEach((item) => {
        const lines = doc.splitTextToSize(`- ${item}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 7;
      });
    }

    doc.save(`interview-report-${Date.now()}.pdf`);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="at-wrap">
      <div className="at-card">
        <div className="at-head">
          <h2 style={{ margin: 0 }}>📚 My Attempts</h2>
          <button className="ai-btn" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="ai-muted" style={{ marginTop: 8 }}>
          API: {API}
        </div>

        {loading ? (
          <div className="ai-muted" style={{ marginTop: 12 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="ai-muted" style={{ marginTop: 12 }}>No attempts saved yet.</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {items.map((a) => (
              <div key={a._id} className="at-item">
                <div className="at-date">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                </div>

                <div className="at-q">Q: {a.question}</div>

                {a.answerText ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="at-sub">Answer</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{a.answerText}</div>
                  </div>
                ) : (
                  <div className="at-sub">(No answer text saved)</div>
                )}

                {a.feedback ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="at-sub">Feedback</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{a.feedback}</div>
                  </div>
                ) : null}

                <div className="at-pillrow">
                  <span className="at-pill">Voice: {a.voiceId || "—"}</span>
                  <span className="at-pill">Score: {a.score ?? "—"}/10</span>

                  <button
                    className="ai-btn"
                    onClick={() => downloadReport(a)}
                    style={{ marginLeft: "auto" }}
                  >
                    Download Report
                  </button>

                  <button
                    className="ai-btn ai-danger"
                    onClick={() => remove(a._id)}
                    disabled={busyId === a._id}
                    title="Delete attempt"
                  >
                    {busyId === a._id ? "Deleting..." : "Delete"}
                  </button>
                </div>

                {a.audioUrl ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="at-sub">Recording</div>
                    <audio controls src={a.audioUrl} className="at-audio" />
                    <div className="at-sub" style={{ marginTop: 6 }}>
                      <a href={a.audioUrl} target="_blank" rel="noreferrer">Open file</a>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
