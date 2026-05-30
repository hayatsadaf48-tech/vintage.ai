export default function Home({ user, onStart, onLogin }) {
  return (
    <div className="home-wrap">
      <div className="ai-card">
        {/* Colorful Badge */}
        <div className="ai-pill" style={{ 
          display: 'inline-block', 
          background: 'var(--nav-grad)', 
          color: 'white', 
          marginBottom: '15px',
          fontWeight: 'bold' 
        }}>
          Interview.AI v2.0
        </div>

        <h1 className="home-title" style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
          Master Your Next Interview with AI
        </h1>
        
        <p className="ai-muted" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto 25px' }}>
          Experience a professional mock interview. Upload PDF questions, listen to AI voices, 
          record your video responses, and get instant feedback with Speech-to-Text analysis.
        </p>

        <div className="home-actions" style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center' }}>
          <button className="ai-btn ai-btn-primary" style={{ padding: '15px 40px', fontSize: '1rem' }} onClick={onStart}>
            🚀 Start Your Interview
          </button>

          {!user ? (
            <button className="ai-btn ai-btn-warning" style={{ padding: '15px 40px', fontSize: '1rem' }} onClick={onLogin}>
              🔐 Login / Register
            </button>
          ) : (
            <div className="ai-section" style={{ padding: '10px 20px', border: '2px solid #3b82f6' }}>
              Welcome back, <b style={{ color: '#1e40af' }}>{user.name}</b>
            </div>
          )}
        </div>

        <div className="ai-muted" style={{ marginTop: '30px', fontStyle: 'italic' }}>
          Tip: Agar aap login nahi hain, to "Start Interview" par click karne se aapko auto login page par bhej diya jayega.
        </div>
      </div>

      {/* Feature Cards Section (Optional Visual Boost) */}
      <div className="vp-list" style={{ marginTop: '40px' }}>
        <div className="vp-item" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>📄</div>
          <h3>PDF to Q&A</h3>
          <p className="ai-muted">Directly extract interview questions from your job description PDF.</p>
        </div>
        <div className="vp-item" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>🎙️</div>
          <h3>Voice & STT</h3>
          <p className="ai-muted">Listen to professional voices and answer via speech recognition.</p>
        </div>
        <div className="vp-item" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem' }}>📊</div>
          <h3>Detailed Score</h3>
          <p className="ai-muted">Get AI-driven scoring and feedback on every answer you give.</p>
        </div>
      </div>
    </div>
  );
}

