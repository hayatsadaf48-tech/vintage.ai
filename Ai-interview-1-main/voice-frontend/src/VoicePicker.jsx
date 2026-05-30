import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

export default function VoicePicker({ onSelect }) {
  const [voices, setVoices] = useState([]);
  const [query, setQuery] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState(
    "Interview shuru hone ja raha hai. Aap taiyaar ho jaaiye."
  );

  // ✅ Load voices - NO LOGIC CHANGE
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/voices`, { credentials: "include" });
        const data = await safeJson(res);

        if (res.status === 401 || res.status === 403) {
          throw new Error("Login required. Pehle login karo phir voices load hongi.");
        }
        if (!res.ok) throw new Error(data.error || "Fetch voices failed");

        const list = data.voices || [];
        if (!alive) return;

        setVoices(list);

        if (!voiceId && list.length) {
          setVoiceId(list[0].voice_id);
          onSelect?.(list[0].voice_id);
        }
      } catch (e) {
        if (!alive) return;
        alert("Fetch voices failed: " + e.message);
      }
    })();
    return () => { alive = false; };
  }, [onSelect, voiceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter((v) => (v.name || "").toLowerCase().includes(q));
  }, [voices, query]);

  // ✅ Play TTS - NO LOGIC CHANGE
  async function play(vid, t) {
    try {
      if (!vid) return alert("Voice select karo");
      if (!t?.trim()) return alert("Text empty hai");

      const res = await fetch(`${API}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: t, voiceId: vid }),
      });

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err.error || "TTS failed");
      }

      const buf = await res.arrayBuffer();
      const mime = res.headers.get("content-type") || "audio/mpeg";
      const blob = new Blob([buf], { type: mime });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      alert("Play failed: " + e.message);
    }
  }

  return (
    <div className="ai-card" style={{ marginBottom: 20 }}>
      {/* Colorful Header Section */}
      <div className="iv-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
        <div>
          <h2 className="iv-title" style={{ color: '#1e40af' }}>🎙️ AI Voice Selection</h2>
          <div className="ai-muted">Choose a voice for your interviewer</div>
        </div>
        <div className="ai-pill">{voices.length} Voices Available</div>
      </div>

      {/* Control Row: Search & Select */}
      <div className="iv-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
        <div>
          <label className="iv-label">SEARCH BY NAME</label>
          <input
            className="ai-input"
            placeholder="Type voice name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="iv-label">QUICK SELECT</label>
          <select
            className="ai-select"
            value={voiceId}
            onChange={(e) => {
              setVoiceId(e.target.value);
              onSelect?.(e.target.value);
            }}
          >
            {filtered.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.name} {v.category ? `(${v.category})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Test Play Row */}
      <div className="ai-section mt-2" style={{ background: '#f8faff', padding: '15px', borderRadius: '12px' }}>
        <label className="iv-label">TEST VOICE (TTS)</label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
          <input
            className="ai-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="ai-btn ai-btn-primary" style={{ minWidth: '100px' }} onClick={() => play(voiceId, text)}>
            🔊 Play
          </button>
        </div>
      </div>

      {/* Grid of Voices */}
      <div className="vp-list" style={{ marginTop: '25px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
        {filtered.map((v) => (
          <div key={v.voice_id} className="vp-item" style={{ 
            border: voiceId === v.voice_id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            background: voiceId === v.voice_id ? '#eff6ff' : '#fff'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#1e293b' }}>{v.name}</div>
              <div className="ai-pill" style={{ padding: '2px 8px', fontSize: '10px', marginTop: '4px' }}>
                {v.category || "General"}
              </div>
            </div>
            <button
              className="ai-btn ai-btn-success"
              style={{ padding: '6px 15px', fontSize: '11px' }}
              onClick={() => play(v.voice_id, `Hello, I am ${v.name}. Ready for the interview?`)}
            >
              Preview
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
