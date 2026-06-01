const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    isPremium: {
      type: Boolean,
      default: false,
    },

    resetOtp: {
  type: String,
},

resetOtpExpires: {
  type: Date,
},

isEmailVerified: {
  type: Boolean,
  default: false,
},

emailVerifyOtp: {
  type: String,
},

emailVerifyOtpExpires: {
  type: Date,
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);