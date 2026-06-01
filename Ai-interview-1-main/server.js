const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const session = require("express-session");
const {MongoStore} = require("connect-mongo");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

const User = require("./models/User");
const Attempt = require("./models/Attempt");
const requireAuth = require("./middleware/auth");

const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("./models/Payment");
const nodemailer = require("nodemailer");

dotenv.config();
const app = express();


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ SMTP ERROR:");
    console.log(error);
  } else {
    console.log("✅ SMTP READY");
  }
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const isProd = process.env.NODE_ENV === "production";

// ✅ Deploy behind proxy (Render/Railway etc.) -> sessions/cookies fix
if (isProd) {
  app.set("trust proxy", 1);
}

/* =========================
   ✅ Folders + Static
========================= */
const UPLOADS_DIR = path.join(__dirname, "uploads");
const AUDIO_DIR = path.join(UPLOADS_DIR, "audio");
const MEDIA_DIR = path.join(UPLOADS_DIR, "media");
const PDF_DIR = path.join(UPLOADS_DIR, "pdfs");

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(PDF_DIR, { recursive: true });

app.use("/uploads", express.static(UPLOADS_DIR));

/* =========================
   ✅ CORS + JSON
========================= */
/**
 * BEST: deploy me frontend+backend same domain pe ho => CORS ki zaroorat nahi
 * Agar frontend alag domain pe ho => FRONTEND_ORIGIN set karo
 * Example: FRONTEND_ORIGIN=https://your-frontend.com
 */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: function (origin, cb) {
      // allow server-to-server / Postman / curl (no origin)
      if (!origin) return cb(null, true);

      // local dev allow
      if (!isProd && origin === FRONTEND_ORIGIN) return cb(null, true);

      // production: if FRONTEND_ORIGIN set, allow only that; else allow same-origin (no need CORS)
      if (isProd) {
        if (process.env.FRONTEND_ORIGIN) {
          return origin === process.env.FRONTEND_ORIGIN
            ? cb(null, true)
            : cb(new Error("CORS blocked: " + origin));
        }
        // if FRONTEND_ORIGIN not set in prod, allow (same-origin deploy case)
        return cb(null, true);
      }

      // fallback
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

/* =========================
   ✅ Multer: Media (audio/video)
========================= */
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mt = (file.mimetype || "").toLowerCase();
    const isVideo = mt.startsWith("video/");
    cb(null, isVideo ? MEDIA_DIR : AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".webm";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mt = (file.mimetype || "").toLowerCase();

    const ok =
      mt.startsWith("audio/webm") ||
      mt.startsWith("video/webm") ||
      mt === "audio/wav" ||
      mt === "audio/x-wav" ||
      mt === "audio/wave" ||
      mt === "audio/mpeg" ||
      mt === "audio/mp3" ||
      mt.startsWith("audio/ogg") ||
      mt === "video/mp4" ||
      mt === "application/octet-stream";

    if (!ok) {
      return cb(
        new Error(
          `Only media files allowed (webm/wav/mp3/ogg + video/webm). Got: ${mt}`
        )
      );
    }
    cb(null, true);
  },
});

/* =========================
   ✅ Multer: PDF
========================= */
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDF_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".pdf";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mt = (file.mimetype || "").toLowerCase();
    const ok = mt === "application/pdf" || mt === "application/x-pdf";
    if (ok) cb(null, true);
    else cb(new Error(`Only PDF allowed. Got: ${mt}`));
  },
});

/* =========================
   ✅ MongoDB
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => console.error("Mongo error:", e.message));

/* =========================
   ✅ Session
========================= */
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" ? true : isProd; // prod true
const COOKIE_SAMESITE =
  process.env.COOKIE_SAMESITE || (isProd ? "none" : "lax"); // prod cross-site -> none

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE, // "lax" OR "none"
      secure: COOKIE_SECURE,     // https on prod
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* =========================
   ✅ Helpers
========================= */
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text || `Non-JSON response (${res.status})` };
}

/* =========================
   ✅ Routes
========================= */

// Health
app.get("/api/health", (req, res) => res.json({ ok: true, msg: "Server running 🚀" }));

// Debug session
app.get("/api/debug/session", (req, res) => {
  res.json({
    hasSession: !!req.session,
    userId: req.session?.userId || null,
    cookie: req.headers.cookie || null,
    origin: req.headers.origin || null,
  });
});

/* ---------- AUTH ---------- */


app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({
        error: "This email is not registered",
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    user.resetOtp = otp;
    user.resetOtpExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    try {
      await transporter.sendMail({
        from: `"AI Interview Platform" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "AI Interview Platform - Password Reset OTP",
        html: `
          <div style="font-family:Arial,sans-serif">
            <h2>Password Reset Request</h2>

            <p>Your OTP is:</p>

            <h1 style="color:#2563eb;">
              ${otp}
            </h1>

            <p>
              This OTP is valid for 10 minutes.
            </p>
          </div>
        `,
      });

      console.log(
        `✅ Password reset OTP sent to ${user.email}`
      );
    } catch (mailErr) {
      console.error("❌ EMAIL SEND FAILED:");
      console.error(mailErr);

      return res.status(500).json({
        error:
          mailErr.message ||
          "Failed to send OTP email",
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});


app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({
        error: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      isEmailVerified: true,
    });

    req.session.userId = user._id;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/verify-register-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found. Please register again." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    if (
      user.emailVerifyOtp !== otp ||
      !user.emailVerifyOtpExpires ||
      user.emailVerifyOtpExpires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    user.isEmailVerified = true;
    user.emailVerifyOtp = undefined;
    user.emailVerifyOtpExpires = undefined;

    await user.save();

    req.session.userId = user._id;

    res.json({
      success: true,
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("VERIFY REGISTER OTP ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      user.resetOtp !== otp ||
      !user.resetOtpExpires ||
      user.resetOtpExpires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    res.json({
      success: true,
      message: "OTP verified",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP and new password required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      user.resetOtp !== otp ||
      !user.resetOtpExpires ||
      user.resetOtpExpires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email/password required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    const ok = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!ok) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    req.session.userId = user._id;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
const user = await User.findById(req.session.userId).select("name email isPremium");
  res.json({ loggedIn: true, user });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ success: true });
  });
});

/* ---------- ELEVENLABS ---------- */

app.get("/api/voices", requireAuth, async (req, res) => {
  try {
    let r = await fetch("https://api.elevenlabs.io/v2/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    });

    if (!r.ok) {
      r = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      });
    }

    if (!r.ok) return res.status(500).json({ error: await r.text() });

    const data = await r.json();
    const voices = (data.voices || []).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
    }));

    res.json({ success: true, voices });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tts", requireAuth, async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text || !voiceId)
    return res.status(400).json({ error: "text & voiceId required" });

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.6,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!r.ok) return res.status(500).json({ error: await r.text() });

    const audio = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.get("/api/check-limit", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("isPremium");

    const totalAttempts = await Attempt.countDocuments({
      userId: req.session.userId,
    });

    const premiumRequired = !user?.isPremium && totalAttempts >= 3;
        console.log("CHECK LIMIT USER:", {
      sessionUserId: req.session.userId,
      isPremium: user?.isPremium,
      totalAttempts,
      premiumRequired,
    });


    res.json({
      success: true,
      premiumRequired,
      totalAttempts,
      isPremium: !!user?.isPremium,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- ATTEMPTS ---------- */

app.post("/api/attempt", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("isPremium");

    const totalAttempts = await Attempt.countDocuments({
      userId: req.session.userId,
    });

    if (!user?.isPremium && totalAttempts >= 3) {
      return res.status(403).json({
        success: false,
        premiumRequired: true,
        error: "Free limit reached. Please upgrade to Premium.",
      });
    }

    const {
      question,
      answerText,
      score,
      feedback,
      voiceId,
      audioUrl,
      mediaUrl,
      what_was_good,
      what_to_improve,
      modelUsed,
    } = req.body;

    if (!question) return res.status(400).json({ error: "question required" });

    const attempt = await Attempt.create({
      userId: req.session.userId,
      question,
      answerText: answerText || "",
     score: Number(score) || 0,
      feedback: feedback || "",
      voiceId: voiceId || "",
      audioUrl: audioUrl || "",
      mediaUrl: mediaUrl || "",
      what_was_good: Array.isArray(what_was_good) ? what_was_good : [],
      what_to_improve: Array.isArray(what_to_improve) ? what_to_improve : [],
      modelUsed: modelUsed || "",
    });

    res.json({ success: true, attempt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/attempts", requireAuth, async (req, res) => {
  try {
    const list = await Attempt.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, attempts: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//
app.get("/api/dashboard-stats", requireAuth, async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.session.userId });

    const totalInterviews = attempts.length;
    const totalScore = attempts.reduce((sum, a) => sum + (Number(a.score) || 0), 0);

    const averageScore = totalInterviews
      ? (totalScore / totalInterviews).toFixed(1)
      : 0;

    const bestScore = totalInterviews
      ? Math.max(...attempts.map((a) => Number(a.score) || 0))
      : 0;

    const user = await User.findById(req.session.userId).select("isPremium");

    res.json({
      success: true,
      totalInterviews,
      averageScore,
      bestScore,
      isPremium: !!user?.isPremium,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//Leaderboard
app.get("/api/leaderboard", requireAuth, async (req, res) => {
  try {
    const attempts = await Attempt.find({})
      .sort({ score: -1, createdAt: -1 })
      .limit(10)
      .populate("userId", "name email");

    const leaderboard = attempts.map((a) => ({
      id: a._id,
      name: a.userId?.name || "User",
      email: a.userId?.email || "",
      score: a.score ?? 0,
      question: a.question || "",
      createdAt: a.createdAt,
    }));

    res.json({
      success: true,
      leaderboard,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/attempt/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Attempt.findOneAndDelete({
      _id: id,
      userId: req.session.userId,
    });

    if (!deleted) return res.status(404).json({ error: "Attempt not found" });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- MEDIA UPLOAD (audio/video) ---------- */
app.post(
  "/api/upload-audio",
  requireAuth,
  uploadMedia.fields([
    { name: "audio", maxCount: 1 },
    { name: "media", maxCount: 1 },
  ]),
  (req, res) => {
    const f1 = req.files?.audio?.[0];
    const f2 = req.files?.media?.[0];
    const file = f1 || f2;

    if (!file) return res.status(400).json({ error: "No media uploaded" });

    const mt = (file.mimetype || "").toLowerCase();
    const isVideo = mt.startsWith("video/");
    const folder = isVideo ? "media" : "audio";

    const fileUrl = `/uploads/${folder}/${file.filename}`;
    res.json({
      success: true,
      fileUrl,
      fileName: file.filename,
      mime: file.mimetype,
      size: file.size,
      kind: isVideo ? "video" : "audio",
    });
  }
);

/* ---------- PDF UPLOAD + QUESTIONS ---------- */
app.post(
  "/api/questions/pdf",
  requireAuth,
  uploadPdf.fields([
    { name: "pdf", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const f1 = req.files?.pdf?.[0];
      const f2 = req.files?.file?.[0];
      const file = f1 || f2;

      if (!file)
        return res
          .status(400)
          .json({ error: "No PDF uploaded (field: pdf/file)" });

      const buf = fs.readFileSync(file.path);
      const parsed = await pdfParse(buf);
      const text = (parsed.text || "").trim();

      if (!text) {
        return res.status(400).json({
          error: "PDF text empty. (Scan PDF ho sakta hai, OCR chahiye.)",
        });
      }

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const questions = lines.filter((l) => {
        const s = l.replace(/\s+/g, " ").trim();
        return (
          s.endsWith("?") ||
          /^q\s*\d+/i.test(s) ||
          /^\d+[\).\s]/.test(s) ||
          /^question\s*\d+/i.test(s)
        );
      });

      res.json({
        success: true,
        fileUrl: `/uploads/pdfs/${file.filename}`,
        totalLines: lines.length,
        totalQuestions: questions.length,
        questions: questions.slice(0, 60),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* ---------- EVALUATE (GROQ) ---------- */
app.post("/api/evaluate", requireAuth, async (req, res) => {
  try {
    const { question, answerText } = req.body;
    if (!question || !answerText)
      return res
        .status(400)
        .json({ error: "question & answerText required" });

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY missing in .env" });
    }

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const systemPrompt = `
You are a strict technical interviewer.
Return ONLY valid JSON in this exact schema:

{
  "score": 0,
  "feedback": "short feedback in Hinglish",
  "what_was_good": ["..."],
  "what_to_improve": ["..."]
}

Rules:
- Give score from 0 to 10.
- 0-2 = wrong or irrelevant answer.
- 3-5 = partially correct but incomplete.
- 6-7 = mostly correct with minor mistakes.
- 8-9 = correct and well explained.
- 10 = perfect interview-ready answer.
- Give partial marks when the answer contains correct concepts.
- Do not be overly strict.
- Keep feedback short and actionable.
`.trim();

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Question: ${question}\n\nAnswer: ${answerText}` },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({
        error: data?.error?.message || JSON.stringify(data),
      });
    }

  const content = data?.choices?.[0]?.message?.content || "";
console.log("AI Response:", content);
let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else
        parsed = {
          score: 0,
          feedback: content || "No feedback",
          what_was_good: [],
          what_to_improve: [],
        };
    }

    res.json({
      success: true,
      score: Number(parsed.score) || 0,
      feedback: parsed.feedback || "",
      what_was_good: parsed.what_was_good || [],
      what_to_improve: parsed.what_to_improve || [],
      modelUsed: model,
      raw: parsed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   ✅ Frontend Serve (PROD)
========================= */
if (isProd) {
  const FRONTEND_DIST = path.join(__dirname, "voice-frontend", "dist");

  // Serve built frontend files
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback (but not for /api or /uploads)
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}
/* =========================
   ✅ Payment Routes - Razorpay
========================= */

// Create Razorpay Order
app.post("/api/payment/create-order", requireAuth, async (req, res) => {
  try {
    const { amount = 99 } = req.body;

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    await Payment.create({
      userId: req.session.userId,
      orderId: order.id,
      amount,
      status: "created",
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Payment
app.post("/api/payment/verify", requireAuth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: "paid",
      }
    );
    await User.findByIdAndUpdate(req.session.userId, {
  isPremium: true,
});

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   ✅ Error + API 404
========================= */
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || "Error" });
  next();
});

// API 404 only (SPA fallback already handled in prod)
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  }
  // non-api in dev
  return res.status(404).send("Not Found");
});



/* =========================
   ✅ Server start
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running http://localhost:${PORT}`));
