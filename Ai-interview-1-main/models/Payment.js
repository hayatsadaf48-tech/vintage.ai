const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: String,
    paymentId: String,
    amount: Number,
    status: {
      type: String,
      default: "pending",
    },
    isPremium: {
  type: Boolean,
  default: false,
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);