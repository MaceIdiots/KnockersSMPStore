import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import rateLimit from "express-rate-limit";

try {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountStr) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountStr))
    });
  } else {
    admin.initializeApp();
  }
} catch (e) {
  console.error("Firebase admin init error", e);
}

const db = getFirestore();

// Function to update coins
async function updateCoins(uid: string, newBalance: number) {
  await db.collection("users").doc(uid).set({
    coins: newBalance
  }, { merge: true });
}

// Function to get coins on login
async function getCoins(uid: string) {
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? doc.data()?.coins : 0;
}

// Ensure audit log function
async function logAudit(transaction: any) {
  try {
    await db.collection("audit_logs").add({
      ...transaction,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

const BACKUPS_FILE = path.join(process.cwd(), "backups.json");

function getBackups() {
  if (fs.existsSync(BACKUPS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(BACKUPS_FILE, "utf-8"));
    } catch (e) {
      console.error("Error reading backups.json:", e);
    }
  }
  return {};
}

function saveBackups(backups: any) {
  try {
    fs.writeFileSync(BACKUPS_FILE, JSON.stringify(backups, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing backups.json:", e);
  }
}

async function createServer() {
  const app = express();
  
  // Apply general rate limiting to prevent API abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200, 
    message: { status: "error", message: "Too many requests, please try again later." }
  });
  
  const purchaseLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 10, 
    message: { status: "error", message: "Purchase rate limit exceeded. Slow down." }
  });

  app.use(express.json());
  app.use("/api/", apiLimiter);

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Verify auth middleware
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      (req as any).user = decoded;
      next();
    } catch (e) {
      console.error("Auth verification failed:", e);
      return res.status(401).json({ success: false, message: "Unauthorized token" });
    }
  };

  // Backend verification for item purchases
  app.post("/api/buy-item", purchaseLimiter, authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    const { itemId, itemType } = req.body;
    
    if (!itemId || !itemType) {
      return res.status(400).json({ success: false, message: "Invalid request payload" });
    }

    try {
      // Dynamic import to use shared KITS/ROLES logic
      const { KITS, ROLES } = await import("./src/types.ts");
      const itemList = itemType === "kit" ? KITS : ROLES;
      const item = (itemList as any[]).find((i: any) => i.id === itemId);
      
      if (!item) {
         throw new Error("Item not found");
      }
      
      const price = item.price;

      const userRef = db.collection("users").doc(uid);
      
      const result = await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) {
          throw new Error("User record not found");
        }
        
        const data = doc.data();
        const currentCoins = data?.coins || 0;
        
        if (currentCoins < price) {
          throw new Error("Insufficient coins for this purchase");
        }
        
        const fieldName = itemType === "kit" ? "ownedKits" : "ownedRoles";
        const currentOwned = data?.[fieldName] || [];
        
        if (currentOwned.includes(itemId)) {
          throw new Error("You already own this item");
        }
        
        t.update(userRef, {
          coins: currentCoins - price,
          [fieldName]: admin.firestore.FieldValue.arrayUnion(itemId)
        });
        
        return currentCoins - price;
      });
      
      // Write audit log
      await logAudit({
        type: "purchase",
        uid,
        itemId,
        itemType,
        price,
        status: "success"
      });
      
      return res.json({ success: true, newBalance: result, price });
    } catch (e: any) {
      console.error("Purchase failed:", e);
      // log failure
      await logAudit({
        type: "purchase",
        uid,
        itemId,
        itemType,
        status: "failed",
        reason: e.message
      });
      return res.status(400).json({ success: false, message: e.message || "Purchase failed" });
    }
  });

  app.post("/api/notify-purchase", purchaseLimiter, async (req, res) => {
    // Extract playerName, itemName, and price from req.body, with fallbacks for alternative formats
    const username = req.body.playerName || req.body.username || req.body.player_name || "Unknown Player";
    const itemName = req.body.itemName || (Array.isArray(req.body.items) ? req.body.items.join(", ") : req.body.items) || "Unknown Item";
    const price = req.body.price !== undefined ? req.body.price : (req.body.amount !== undefined ? req.body.amount : "0");
    const playerBio = req.body.playerBio || "No bio provided";

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env["DISCORD WEBHOOK URL"] || process.env.DISCORD_WEBHOOK || process.env.discord_webhook;

    if (!webhookUrl) {
      console.warn("DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is missing in settings. Purchase webhook skipped.");
      return res.status(400).json({ 
        status: "error", 
        message: "Discord notification skipped. DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL is not defined in settings." 
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "⚡ Successful Checkout",
            description: "A secure purchase completed successfully.",
            color: 16711680, // Red
            fields: [
              { name: "👤 Player Username", value: `\`\`\`${username}\`\`\``, inline: true },
              { name: "📝 Player Bio", value: `\`\`\`${playerBio}\`\`\``, inline: true },
              { name: "\u200b", value: "\u200b", inline: false },
              { name: "📦 Bought Item", value: `\`\`\`${itemName}\`\`\``, inline: true },
              { name: "💰 Price", value: `\`\`\`${price} Coins\`\`\``, inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "Knockers SMP Store" }
          }]
        })
      });
      return res.json({ status: "ok", message: "Discord webhook notification dispatched successfully!" });
    } catch (err: any) {
      console.error("Discord Notification failed:", err);
      return res.status(500).json({ 
        status: "error", 
        message: `Internal server error during Discord Webhook dispatch: ${err.message || err}` 
      });
    }
  });

  // Webhook endpoints to handle successful checkout notifications via DISCORD_WEBHOOK_URL
  const handleCheckoutWebhook = async (req: express.Request, res: express.Response) => {
    // Collect player's [Username], [Item Name], and [Price] from request body
    const username = req.body.username || req.body.Username || req.body.playerName || req.body.player_name || "Unknown Player";
    const itemName = req.body.itemName || req.body.item_name || req.body["Item Name"] || req.body.item || (Array.isArray(req.body.items) ? req.body.items.join(", ") : req.body.items) || "Unknown Item";
    const price = req.body.price || req.body.Price || req.body.amount || req.body.total || "0";
    const playerBio = req.body.playerBio || req.body.bio || req.body.PlayerBio || "No bio provided";

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env["DISCORD WEBHOOK URL"] || process.env.DISCORD_WEBHOOK || process.env.discord_webhook;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is missing.");
      return res.status(500).json({ 
        status: "error", 
        message: "DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is not defined in the applet's settings." 
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "⚡ Successful Checkout",
            description: "A secure purchase completed successfully.",
            color: 16711680, // Red
            fields: [
              { name: "👤 Player Username", value: `\`\`\`${username}\`\`\``, inline: true },
              { name: "📝 Player Bio", value: `\`\`\`${playerBio}\`\`\``, inline: true },
              { name: "\u200b", value: "\u200b", inline: false },
              { name: "📦 Bought Item", value: `\`\`\`${itemName}\`\`\``, inline: true },
              { name: "💰 Price", value: `\`\`\`${price} Coins\`\`\``, inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "Knockers SMP Store" }
          }]
        })
      });

      // Update coins in Firebase
      try {
        const usernameLower = username.toLowerCase();
        const nameDoc = await db.collection("usernames").doc(usernameLower).get();
        if (nameDoc.exists) {
          const uid = nameDoc.data()?.uid;
          if (uid) {
            // Attempt to parse coin amount from itemName (e.g., "50,000 Coins" or "50k Coins")
            const itemNameStr = String(itemName);
            let addCoins = 0;
            const match = itemNameStr.match(/(?:^|\s)([\d,]+)(?:[kK])?(?:\s*Coins?)(?:$|\s)/i) || itemNameStr.match(/([\d,]+)\s*Coins/i);
            if (match) {
              addCoins = parseInt(match[1].replace(/,/g, ''), 10);
              if (itemNameStr.match(/[kK]\s*Coins?/i)) {
                addCoins *= 1000;
              }
            } else {
              // Fallback to parsing the price
              const priceNum = parseInt(String(price).replace(/,/g, ''), 10);
              if (!isNaN(priceNum) && priceNum > 0) {
                addCoins = priceNum;
              }
            }

            if (addCoins > 0) {
              const currentCoins = await getCoins(uid);
              const newBalance = (currentCoins || 0) + addCoins;
              await updateCoins(uid, newBalance);
              console.log(`Added ${addCoins} coins to ${username} (UID: ${uid}). New balance: ${newBalance}`);
            }
          }
        }
      } catch (dbErr) {
        console.error("Failed to update coins in Firestore:", dbErr);
      }

      res.json({ status: "ok", message: "Discord webhook notification dispatched successfully!" });
    } catch (err: any) {
      console.error("Discord Notification failed:", err);
      res.status(500).json({ status: "error", message: `Internal server error during Discord Webhook dispatch: ${err.message || err}` });
    }
  };

  app.post("/api/vercel-webhook", handleCheckoutWebhook);
  app.post("/api/checkout-webhook", handleCheckoutWebhook);
  app.post("/api/store-webhook", handleCheckoutWebhook);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  return app;
}

// Start the server for all environments (dev and production)
createServer().then(app => {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});

export default createServer();


