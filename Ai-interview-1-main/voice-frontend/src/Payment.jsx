const API = import.meta.env.VITE_API_BASE || "";

export default function Payment() {
  async function handlePayment() {
    try {
      const res = await fetch(`${API}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: 99 }),
      });

      const data = await res.json();
      if (!data.success) return alert(data.error || "Order create failed");

      const options = {
        key: data.key,
        amount: data.order.amount,
        currency: "INR",
        name: "InterviewAI Premium",
        description: "Premium Interview Plan",
        order_id: data.order.id,

        handler: async function (response) {
          const verifyRes = await fetch(`${API}/api/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(response),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            alert("Payment Successful ✅ Premium Activated");
            window.dispatchEvent(new CustomEvent("payment-success"));
          } else {
            alert(verifyData.error || "Payment verification failed");
          }
        },

        theme: {
          color: "#4f46e5",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Payment error: " + err.message);
    }
  }

  return (
    <div className="ai-card" style={{ marginTop: 20 }}>
      <h1>Upgrade to Premium</h1>

      <div
        style={{
          marginTop: 20,
          padding: 28,
          border: "1px solid #e6ecf6",
          borderRadius: 18,
          background: "#fff",
        }}
      >
        <h2>Premium Interview Plan</h2>
        <h1>₹99</h1>
        <p>
          Unlock AI Interview Practice, Voice Questions, PDF Question Upload,
          Smart Evaluation and Premium Access.
        </p>

        <button className="ai-btn ai-btn-primary" onClick={handlePayment}>
          Buy Now
        </button>
      </div>
    </div>
  );
}