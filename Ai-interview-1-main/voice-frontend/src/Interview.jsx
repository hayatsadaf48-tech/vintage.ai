import { useEffect, useMemo, useRef, useState } from "react";
import VoicePicker from "./VoicePicker";
import jsPDF from "jspdf";

const API = import.meta.env.VITE_API_BASE || "";

const DEFAULT_QUESTIONS = [
  "Tell me about yourself.",
  "What projects have you built and what tech stack did you use?",
  "Explain REST API and how you designed one in Node.js.",
  "What is the difference between SQL and MongoDB? When would you use each?",
  "Explain React state and props with an example.",
  "What is middleware in Express? Give an example.",
  "Explain JWT authentication flow.",
  "What is CORS and why does it happen?",
];

function pickMime(hasVideo) {
  const videoTypes = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
  const audioTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const list = hasVideo ? videoTypes : audioTypes;
  for (const t of list) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return "";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

export default function Interview() {
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [index, setIndex] = useState(0);
  const question = useMemo(() => questions[index] || "", [questions, index]);

  const [voiceId, setVoiceId] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const [camOn, setCamOn] = useState(false);
  const camStreamRef = useRef(null);
  const videoRef = useRef(null);

  const audioCtxRef = useRef(null);
  const destRef = useRef(null);

  const [recOn, setRecOn] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const lastBlobRef = useRef(null);
  const stopResolveRef = useRef(null);

  const [mediaUrl, setMediaUrl] = useState("");
  const mediaUrlRef = useRef("");
  const [mediaKind, setMediaKind] = useState("audio");

  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [pdfLoading, setPdfLoading] = useState(false);

  const [sttOn, setSttOn] = useState(false);
  const sttOnRef = useRef(false);
  const recognitionRef = useRef(null);

  const [answerText, setAnswerText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState([]);
const [finalReport, setFinalReport] = useState(null);

const PremiumModal = () => (
  <div className="premium-modal-overlay">
    <div className="premium-modal">
      <h2>🚀 Premium Required</h2>
      <p>Free limit reached. Redirecting you to Premium upgrade...</p>
    </div>
  </div>
);

useEffect(() => {
  async function checkLimit() {
    try {
      const res = await fetch(`${API}/api/check-limit`, {
        credentials: "include",
      });

      const data = await res.json();

      if (data.premiumRequired) {
        setShowPremiumModal(true);

        setTimeout(() => {
          setShowPremiumModal(false);
          window.dispatchEvent(new CustomEvent("open-payment"));
        }, 1800);
      }
    } catch (err) {
      console.error(err);
    }
  }

  checkLimit();
}, []);

  useEffect(() => {
    const v = videoRef.current;
    const s = camStreamRef.current;

    if (camOn && v && s) {
      v.srcObject = s;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      const tryPlay = () => v.play().catch(() => {});
      v.onloadedmetadata = tryPlay;
      tryPlay();
    }

    if (!camOn && v) {
      try {
        v.pause();
      } catch {}
      v.srcObject = null;
    }
  }, [camOn]);

  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {}

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (mediaUrlRef.current) {
        URL.revokeObjectURL(mediaUrlRef.current);
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      camStreamRef.current = s;
      setCamOn(true);
    } catch (e) {
      alert("Camera error: " + e.message);
    }
  }

  function stopCamera() {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    camStreamRef.current = null;
    setCamOn(false);
  }

  function ensureSTT() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      alert("Speech-to-Text supported nahi hai.");
      return null;
    }

    const r = new SR();
    r.lang = "hi-IN";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + " ";
      }

      if (finalText.trim()) {
        setAnswerText((prev) => (prev + " " + finalText).trim());
      }
    };

    r.onerror = () => {
      setSttOn(false);
      sttOnRef.current = false;
    };

    r.onend = () => {
      if (sttOnRef.current) {
        try {
          r.start();
        } catch {}
      }
    };

    recognitionRef.current = r;
    return r;
  }

  function startSTT() {
    if (sttOnRef.current) return;

    const r = recognitionRef.current || ensureSTT();
    if (!r) return;

    sttOnRef.current = true;
    setSttOn(true);

    try {
      r.start();
    } catch {
      sttOnRef.current = false;
      setSttOn(false);
    }
  }

  function stopSTT() {
    sttOnRef.current = false;
    setSttOn(false);

    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {}
    }
  }

  async function speak(text) {
  if (!text || speaking) return;

  setSpeaking(true);

  try {
    // First try ElevenLabs
    if (voiceId) {
      const res = await fetch(`${API}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, voiceId }),
      });

      if (res.ok) {
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a.volume = 1;

        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ctx = audioCtxRef.current;
        await ctx.resume();

        const node = ctx.createMediaElementSource(a);
        node.connect(ctx.destination);

        if (destRef.current) {
          node.connect(destRef.current);
        }

        await new Promise((resolve, reject) => {
          a.onended = resolve;
          a.onerror = reject;
          a.play().catch(reject);
        });

        node.disconnect();
        URL.revokeObjectURL(url);
        return;
      }
    }

    // Fallback: Browser voice
    await new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-IN";
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  } finally {
    setSpeaking(false);
  }
}

  async function startRecording() {
    setResult(null);
    setUploadedUrl("");
    lastBlobRef.current = null;

    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
    }

    mediaUrlRef.current = "";
    setMediaUrl("");
    chunksRef.current = [];

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    await ctx.resume();

    destRef.current = ctx.createMediaStreamDestination();

    const mic = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    micStreamRef.current = mic;

    const micNode = ctx.createMediaStreamSource(mic);
    micNode.connect(destRef.current);

    const hasVideo = !!camStreamRef.current?.getVideoTracks?.().length;
    const tracks = [];

    if (hasVideo) {
      tracks.push(...camStreamRef.current.getVideoTracks());
      setMediaKind("video");
    } else {
      setMediaKind("audio");
    }

    tracks.push(...destRef.current.stream.getAudioTracks());

    const mixedStream = new MediaStream(tracks);
    const mime = pickMime(hasVideo);

    const rec = mime
      ? new MediaRecorder(mixedStream, { mimeType: mime })
      : new MediaRecorder(mixedStream);

    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = () => {
      const forcedType = hasVideo ? "video/webm" : "audio/webm";
      const blob = new Blob(chunksRef.current, { type: forcedType });

      lastBlobRef.current = blob;

      const url = URL.createObjectURL(blob);
      mediaUrlRef.current = url;
      setMediaUrl(url);

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }

      if (stopResolveRef.current) {
        stopResolveRef.current(blob);
        stopResolveRef.current = null;
      }
    };

    rec.start(250);
    setRecOn(true);
  }

  function stopRecordingWaitBlob() {
    return new Promise((resolve) => {
      const rec = recorderRef.current;

      if (!rec || rec.state === "inactive") {
        return resolve(lastBlobRef.current);
      }

      stopResolveRef.current = resolve;

      try {
        rec.stop();
      } catch {
        stopResolveRef.current = null;
        resolve(lastBlobRef.current);
      }

      setRecOn(false);
    });
  }

  async function handlePdfChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    try {
      setPdfLoading(true);

      const fd = new FormData();
      fd.append("pdf", file);

      const res = await fetch(`${API}/api/questions/pdf`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || "PDF failed");
      }

      setQuestions(data.questions?.length ? data.questions : DEFAULT_QUESTIONS);
      setIndex(0);
      setAnswerText("");
      setResult(null);

      alert(`✅ Loaded ${data.totalQuestions || 0} questions`);
    } catch (e2) {
      alert("PDF error: " + e2.message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function uploadBlob(blob) {
    if (!blob) throw new Error("No recording");

    const kind = mediaKind;
    const forcedType = kind === "video" ? "video/webm" : "audio/webm";
    const bt = (blob.type || "").toLowerCase();

    const fixedBlob = bt && !bt.startsWith("text/")
      ? blob
      : new Blob([blob], { type: forcedType });

    const fd = new FormData();
    const field = kind === "video" ? "media" : "audio";

    fd.append(field, fixedBlob, "recording.webm");

    const res = await fetch(`${API}/api/upload-audio`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }

    return `${API}${data.fileUrl}`;
  }

  async function startQuestionFlow(qText) {
    if (!qText) return;

    if (!voiceId) {
      return alert("Pehle voice select karo.");
    }

    setResult(null);
    setUploadedUrl("");
    setAnswerText("");

    await startRecording();
    await speak(qText);
    startSTT();
  }

  async function startCurrentQuestion() {
    try {
      await startQuestionFlow(question);
    } catch (e) {
      alert("Error: " + e.message);
      stopSTT();
      setRecOn(false);
    }
  }

  async function stopNow() {
    try {
      stopSTT();
      await stopRecordingWaitBlob();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  async function uploadNow() {
    try {
      setUploading(true);
      const url = await uploadBlob(lastBlobRef.current);
      setUploadedUrl(url);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function downloadFinalReport(report) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("AI Interview Final Report", 14, 20);

  doc.setFontSize(12);
  doc.text(`Overall Score: ${report.averageScore}/10`, 14, 35);
  doc.text(`Status: ${report.status}`, 14, 45);
  doc.text(`Total Questions: ${report.totalQuestions}`, 14, 55);

  let y = 70;

  report.attempts.forEach((a, i) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.text(`Q${i + 1}: ${a.question}`, 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Score: ${a.score}/10`, 14, y);
    y += 7;

    const feedbackLines = doc.splitTextToSize(
      `Feedback: ${a.feedback || "No feedback"}`,
      180
    );
    doc.text(feedbackLines, 14, y);
    y += feedbackLines.length * 7 + 8;
  });

  doc.save(`Final-Interview-Report-${Date.now()}.pdf`);
}



  async function submitAnswer() {
    try {
      if (!question || !answerText.trim()) {
        return alert("Answer empty hai.");
      }

      setEvaluating(true);

      let blob = lastBlobRef.current;

      if (recOn) {
        stopSTT();
        blob = await stopRecordingWaitBlob();
      }

      let finalUrl = uploadedUrl || "";

      if (!finalUrl && blob) {
        setUploading(true);
        finalUrl = await uploadBlob(blob);
        setUploading(false);
        setUploadedUrl(finalUrl);
      }

      const evRes = await fetch(`${API}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question, answerText }),
      });

      const evData = await safeJson(evRes);

      if (!evRes.ok) {
        throw new Error(evData.error || "Evaluate failed");
      }

      setResult(evData);

      const saveRes = await fetch(`${API}/api/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question,
          answerText,
          score: evData.score,
          feedback: evData.feedback,
          voiceId,
          audioUrl: finalUrl,
          what_was_good: evData.what_was_good || [],
          what_to_improve: evData.what_to_improve || [],
          modelUsed: evData.modelUsed || "",
        }),
      });

      const saveData = await safeJson(saveRes);

      if (!saveRes.ok) {
        if (saveData.premiumRequired) {
         
         setShowPremiumModal(true);
          
          return;
        }

        throw new Error(saveData.error || "Save failed");
      }


      const currentAttempt = {
  question,
  answerText,
  score: Number(evData.score) || 0,
  feedback: evData.feedback || "",
  what_was_good: evData.what_was_good || [],
  what_to_improve: evData.what_to_improve || [],
};

const updatedAttempts = [...sessionAttempts, currentAttempt];
setSessionAttempts(updatedAttempts);

      const nextIndex = index + 1;

    if (nextIndex < questions.length) {
  setIndex(nextIndex);
  setAnswerText("");
  setResult(null);
  setUploadedUrl("");
} else {
  const totalScore = updatedAttempts.reduce((sum, a) => sum + a.score, 0);
  const avgScore = updatedAttempts.length
    ? (totalScore / updatedAttempts.length).toFixed(1)
    : 0;

  setFinalReport({
    totalQuestions: updatedAttempts.length,
    averageScore: avgScore,
    attempts: updatedAttempts,
    status:
      avgScore >= 8
        ? "Excellent"
        : avgScore >= 6
        ? "Good"
        : avgScore >= 4
        ? "Average"
        : "Needs Improvement",
  });

  alert("✅ Interview Finished! Final report generated.");
}
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setEvaluating(false);
      setUploading(false);
    }
  }

  return (
    
    <>
    {showPremiumModal && <PremiumModal />}


    {finalReport && (
  <div className="iv-wrap">
    <div className="ai-card final-report-card">
      <h2 className="iv-title">🎯 Final Interview Report</h2>

      <div className="final-score-box">
        <div>
          <div className="iv-sub">Overall Score</div>
          <h1>{finalReport.averageScore}/10</h1>
        </div>

        <span className="ai-pill">{finalReport.status}</span>
      </div>

      <div className="final-stats">
        <div className="final-stat">
          <strong>{finalReport.totalQuestions}</strong>
          <span>Total Questions</span>
        </div>

        <div className="final-stat">
          <strong>{finalReport.attempts.filter((a) => a.score >= 6).length}</strong>
          <span>Good Answers</span>
        </div>

        <div className="final-stat">
          <strong>{finalReport.attempts.filter((a) => a.score < 6).length}</strong>
          <span>Need Practice</span>
        </div>
      </div>

      <h3 className="iv-title mt-2">Question-wise Performance</h3>

      <div className="final-table">
        {finalReport.attempts.map((a, i) => (
          <div className="final-row" key={i}>
            <div className="final-qno">Q{i + 1}</div>
            <div className="final-qtext">{a.question}</div>
            <div className="final-qscore">{a.score}/10</div>
          </div>
        ))}
      </div>
      <button
  className="ai-btn ai-btn-primary"
  style={{ marginTop: 20, marginRight: 10 }}
  onClick={() => downloadFinalReport(finalReport)}
>
  Download Final PDF
</button>

      <button
        className="ai-btn ai-btn-primary"
        style={{ marginTop: 20 }}
        onClick={() => {
          setFinalReport(null);
          setIndex(0);
          setAnswerText("");
          setSessionAttempts([]);
          setResult(null);
        }}
      >
        Start New Interview
      </button>
    </div>
  </div>
)}
 {!finalReport && (
    <div className="iv-wrap">
      <div className="ai-card">
        <VoicePicker onSelect={setVoiceId} />
      </div>

      <div className="iv-grid">
        <div className="iv-left-col ai-card">
          <div className="iv-header">
            <div>
              <h2 className="iv-title">🧑‍💼 Live Interview Session</h2>
              <div className="iv-sub">Answer clearly to get a better score.</div>
            </div>

            <div className="ai-pill">
              Question {index + 1} of {questions.length}
            </div>
          </div>

          <div className="ai-section">
            <div className="iv-label">LOAD QUESTIONS FROM PDF</div>
            <input
              type="file"
              className="ai-input"
              accept=".pdf"
              onChange={handlePdfChange}
            />
            {pdfLoading && <div className="ai-muted mt-2">Reading PDF Content...</div>}
          </div>

          <div className="iv-qbox mt-2">
            <span className="iv-label">CURRENT QUESTION</span>
            <div className="iv-qtext">{question}</div>
          </div>

          <div className="iv-controls">
            <button
              className="ai-btn ai-btn-primary"
              onClick={startCurrentQuestion}
              disabled={speaking || recOn}
            >
              {recOn ? "🔴 Recording..." : "▶ Start Interaction"}
            </button>

            {recOn && (
              <button className="ai-btn ai-btn-danger" onClick={stopNow}>
                ⏹ Stop
              </button>
            )}

            {!recOn && mediaUrl && !uploadedUrl && (
              <button
                className="ai-btn ai-btn-success"
                onClick={uploadNow}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "⬆ Upload Response"}
              </button>
            )}

            <button
              className="ai-btn ai-btn-primary"
              onClick={submitAnswer}
              disabled={evaluating || !answerText.trim()}
            >
              {evaluating ? "Evaluating..." : "✅ Submit Answer"}
            </button>
          </div>

          <div className="mt-2">
            <div className="iv-label">YOUR ANSWER (Speech-to-Text)</div>

            <textarea
              className="ai-textarea"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Your answer will appear here as you speak..."
            />

            <div className="ai-muted mt-2">
              STT: <b>{sttOn ? "Listening..." : "Idle"}</b> | Mode:{" "}
              <b>{mediaKind}</b>
            </div>
          </div>

          {result && (
            <div className="iv-result ai-card">
              <h3>Result Analysis</h3>
              <div className="ai-pill">
                Score: {result.score === 1 ? "Passed" : "Needs Work"}
              </div>
              <p className="mt-2">{result.feedback}</p>
            </div>
          )}
        </div>

        <div className="iv-right-col">
          <div className="ai-card">
            <div className="iv-header">
              <h3 className="iv-title">Camera Feed</h3>

              <button
                className={`ai-btn ${camOn ? "ai-btn-danger" : "ai-btn-primary"}`}
                onClick={camOn ? stopCamera : startCamera}
              >
                {camOn ? "Camera OFF" : "Camera ON"}
              </button>
            </div>

            <div className="cam-box mt-2">
              {camOn ? (
                <video
                  ref={videoRef}
                  className="cam-video"
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <div className="cam-off">Camera is Turned Off</div>
              )}
            </div>
          </div>

          {mediaUrl && (
            <div className="ai-card">
              <h3 className="iv-title">Recording Preview</h3>

              <div className="iv-preview mt-2">
                {mediaKind === "video" ? (
                  <video controls src={mediaUrl} />
                ) : (
                  <audio controls src={mediaUrl} />
                )}
              </div>

              {uploadedUrl && (
                <div className="iv-uploadlink">
                  Saved:{" "}
                  <a href={uploadedUrl} target="_blank" rel="noreferrer">
                    Cloud Storage Link
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    )}
     </>
  );
}
