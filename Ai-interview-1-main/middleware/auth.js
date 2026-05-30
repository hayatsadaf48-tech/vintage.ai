// ./middleware/auth.js
module.exports = function requireAuth(req, res, next) {
  try {
    // session not present or user not logged in
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: "Not logged in",
        hint: "Login karo aur ensure karo frontend & backend same host (localhost) use kar rahe hain + credentials: 'include'.",
      });
    }

    // helpful for routes
    req.userId = req.session.userId;

    return next();
  } catch (e) {
    return res.status(401).json({ error: "Not logged in" });
  }
};
