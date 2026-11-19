const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const THEOREMREACH_SECRET_KEY = "YOUR_THEOREMREACH_SECRET_KEY";

module.exports = async (req, res) => {
  try {
    const { user_id: userId, tx_id: txId, hash } = req.query;
    const reward = parseInt(req.query.reward || "0", 10);

    if (!userId || !txId || reward <= 0) {
      return res.status(400).send("Invalid parameters");
    }

    if (THEOREMREACH_SECRET_KEY !== "YOUR_THEOREMREACH_SECRET_KEY" && hash) {
      const fullUrl = `https://${req.headers.host}${req.url.split("&hash=")[0]}`;
      const expectedHash = crypto
        .createHmac("sha1", THEOREMREACH_SECRET_KEY)
        .update(fullUrl)
        .digest("hex");
      if (hash !== expectedHash) {
        return res.status(403).send("Invalid signature");
      }
    }

    const txRef = db.collection("theoremreach_tx").doc(txId);
    const txDoc = await txRef.get();
    if (txDoc.exists) return res.status(200).send("1");

    const userRef = db.collection("users").doc(userId);
    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) return;

      t.update(userRef, {
        coins: admin.firestore.FieldValue.increment(reward),
      });
      t.set(userRef.collection("history").doc(), {
        title: "TheoremReach Survey Reward",
        coins: reward,
        type: "credit",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      t.set(txRef, {
        userId,
        reward,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).send("1");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server Error");
  }
};