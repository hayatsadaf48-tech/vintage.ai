const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    question: { type: String, required: true, trim: true },
    answerText: { type: String, default: "" },

    score: { type: Number, default: 0 }, // 0/1
    feedback: { type: String, default: "" },

    voiceId: { type: String, default: "" },

    // media
    mediaUrl: { type: String, default: "" }, // optional (if you use)
    audioUrl: { type: String, default: "" }, // ✅ you are using this in backend

    // evaluation extras
    what_was_good: { type: [String], default: [] },
    what_to_improve: { type: [String], default: [] },
    modelUsed: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attempt", attemptSchema);
