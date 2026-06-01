import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

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
  app.use(express.json());

  // API routes
  app.get("/api/confirm-save", (req, res) => {
    const uid = (req.query.uid as string) || "guest_user";
    const coinsStr = (req.query.coins as string) || "0";
    const coins = parseInt(coinsStr, 10) || 0;
    const kitsStr = (req.query.kits as string) || "";
    const ownedKits = kitsStr ? kitsStr.split(",").filter(Boolean) : [];
    const rolesStr = (req.query.roles as string) || "";
    const ownedRoles = rolesStr ? rolesStr.split(",").filter(Boolean) : [];
    const playerName = (req.query.playerName as string) || "Unknown Player";

    const backups = getBackups();
    backups[uid] = {
      coins,
      ownedKits,
      ownedRoles,
      playerName,
      timestamp: Date.now()
    };
    saveBackups(backups);

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Progress Backup Saved!</title>
  <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap');
    body {
      font-family: 'Inter', sans-serif;
    }
    .heading {
      font-family: 'Space Grotesk', sans-serif;
    }
    .mono {
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
    <!-- Glowing green background highlight -->
    <div class="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
      <span class="text-4xl animate-bounce">✅</span>
    </div>
    
    <h1 class="heading text-2xl font-bold tracking-tight mb-2 text-white">Progress Saved Successfully!</h1>
    <p class="text-zinc-400 text-sm mb-6">Your Coins and Shop inventory are backed up and initialized securely.</p>
    
    <div class="bg-zinc-950/60 rounded-xl p-4 mb-6 border border-zinc-800 text-left">
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-800/40">
        <span class="text-xs text-zinc-500">Player</span>
        <span class="text-sm font-semibold text-emerald-400 font-mono">${playerName}</span>
      </div>
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-800/40">
        <span class="text-xs text-zinc-500">Coin Balance</span>
        <span class="text-sm font-bold text-yellow-500 font-mono">${coins} € Coins</span>
      </div>
      <div class="flex justify-between items-center py-1.5">
        <span class="text-xs text-zinc-500">Kits & Roles</span>
        <span class="text-xs text-zinc-300 font-mono">${ownedKits.length} Kits, ${ownedRoles.length} Roles</span>
      </div>
    </div>
    
    <p class="text-xs text-zinc-500 leading-relaxed mb-6">
      When you refresh or return to the Knockers SMP website, your progress will be automatically updated down to the exact coin.
    </p>
    
    <a href="/" class="inline-flex w-full items-center justify-center bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition duration-150 shadow-lg shadow-emerald-900/20 cursor-pointer">
      Return to Store
    </a>
  </div>
</body>
</html>`);
  });

  app.get("/api/check-backup", (req, res) => {
    const uid = req.query.uid as string;
    if (!uid) {
      return res.status(400).json({ status: "error", message: "Missing uid parameter" });
    }
    const backups = getBackups();
    const backup = backups[uid];
    if (backup) {
      return res.json({ status: "ok", found: true, backup });
    }
    return res.json({ status: "ok", found: false });
  });

  app.post("/api/clear-backup", (req, res) => {
    const uid = req.body.uid || (req.query.uid as string);
    if (!uid) {
      return res.status(400).json({ status: "error", message: "Missing uid parameter" });
    }
    const backups = getBackups();
    if (backups[uid]) {
      delete backups[uid];
      saveBackups(backups);
    }
    return res.json({ status: "ok" });
  });
  app.post("/api/notify-purchase", async (req, res) => {
    // Extract playerName, itemName, and price from req.body, with fallbacks for alternative formats
    const playerName = req.body.playerName || req.body.username || req.body.player_name || "Unknown Player";
    const itemName = req.body.itemName || (Array.isArray(req.body.items) ? req.body.items.join(", ") : req.body.items) || "Unknown Item";
    const price = req.body.price !== undefined ? req.body.price : (req.body.amount !== undefined ? req.body.amount : "0");

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env["DISCORD WEBHOOK URL"] || process.env.DISCORD_WEBHOOK || process.env.discord_webhook;

    if (!webhookUrl) {
      console.warn("DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is missing in settings. Purchase webhook skipped.");
      return res.status(400).json({ 
        status: "error", 
        message: "Discord notification skipped. DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL is not defined in settings." 
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: "💰 Successful Store Purchase!",
              description: "A new transaction was processed successfully in the web store.",
              color: 0xDC2626, // Solid red border color to match the site's theme
              fields: [
                {
                  name: "👤 Player Username",
                  value: `\`\`\`${playerName}\`\`\``,
                  inline: true
                },
                {
                  name: "🎁 Bought Item",
                  value: `\`\`\`${itemName}\`\`\``,
                  inline: true
                },
                {
                  name: "🪙 Total Price",
                  value: `\`\`\`${price} Coins\`\`\``,
                  inline: true
                }
              ],
              timestamp: new Date().toISOString(),
              footer: {
                text: "Knockers SMP Official Web Store",
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Discord Webhook API returned non-OK status:", response.status, errorText);
        return res.status(500).json({ 
          status: "error", 
          message: `Discord endpoint returned non-OK status (${response.status}).` 
        });
      }

      return res.json({ status: "ok", message: "Discord webhook notification dispatched successfully!" });
    } catch (error: any) {
      console.error("Webhook processing error in buy notify route:", error);
      return res.status(500).json({ 
        status: "error", 
        message: `Internal server error during Discord Webhook dispatch: ${error.message || error}` 
      });
    }
  });

  app.post("/api/save-progress-webhook", async (req, res) => {
    const playerName = req.body.playerName || req.body.username || "Unknown Player";
    const coins = req.body.coins !== undefined ? req.body.coins : 0;
    const ownedKitsCount = Array.isArray(req.body.ownedKits) ? req.body.ownedKits.length : 0;
    const ownedRolesCount = Array.isArray(req.body.ownedRoles) ? req.body.ownedRoles.length : 0;
    const uid = req.body.uid || "guest_user";

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env["DISCORD WEBHOOK URL"] || process.env.DISCORD_WEBHOOK || process.env.discord_webhook;

    if (!webhookUrl) {
      console.warn("DISCORD_WEBHOOK_URL environment variable is missing in settings. Progress webhook skipped.");
      return res.status(400).json({ 
        status: "error", 
        message: "Discord notification skipped. DISCORD_WEBHOOK_URL is not defined in settings." 
      });
    }

    try {
      const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const host = req.headers.host || req.get("host") || "localhost:3000";
      const appUrl = `${protocol}://${host}`;
      
      const kitsCsv = Array.isArray(req.body.ownedKits) ? req.body.ownedKits.join(",") : "";
      const rolesCsv = Array.isArray(req.body.ownedRoles) ? req.body.ownedRoles.join(",") : "";
      
      const saveLink = `${appUrl}/api/confirm-save?uid=${encodeURIComponent(uid)}&coins=${coins}&kits=${encodeURIComponent(kitsCsv)}&roles=${encodeURIComponent(rolesCsv)}&playerName=${encodeURIComponent(playerName)}`;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `✅ **[Save Progress? Click here to authorize progress backup for ${playerName}](${saveLink})**`,
          embeds: [
            {
              title: "🟢 Save Progress?",
              description: `A player is leaving or has closed their browser tab. To manually freeze and secure your stats, please click the verification link below.\n\n### [✅ CLICK HERE TO SAVE & RESTORE COINS](${saveLink})`,
              color: 0x16A34A, // Emerald green
              fields: [
                {
                  name: "👤 Player Username",
                  value: `\`\`\`${playerName}\`\`\``,
                  inline: true
                },
                {
                  name: "🪙 Coin Balance",
                  value: `\`\`\`${coins} Coins\`\`\``,
                  inline: true
                },
                {
                  name: "🎒 Owned Kits & Roles",
                  value: `\`\`\`${ownedKitsCount} Kits, ${ownedRolesCount} Roles\`\`\``,
                  inline: true
                },
                {
                  name: "🆔 Player Account ID",
                  value: `\`\`\`${uid}\`\`\``,
                  inline: false
                }
              ],
              timestamp: new Date().toISOString(),
              footer: {
                text: "Knockers SMP - Autosave Safety Net Enabled",
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Discord Webhook API returned non-OK status:", response.status, errorText);
        return res.status(500).json({ 
          status: "error", 
          message: `Discord endpoint returned non-OK status (${response.status}).` 
        });
      }

      return res.json({ status: "ok", message: "Progress save webhook notification sent to Discord!" });
    } catch (error: any) {
      console.error("Webhook processing error in save progress route:", error);
      return res.status(500).json({ 
        status: "error", 
        message: `Internal server error during Discord Webhook dispatch: ${error.message || error}` 
      });
    }
  });

  // Webhook endpoints to handle successful checkout notifications via DISCORD_WEBHOOK_URL
  const handleCheckoutWebhook = async (req: express.Request, res: express.Response) => {
    // Collect player's [Username], [Item Name], and [Price] from request body
    const username = req.body.username || req.body.Username || req.body.playerName || req.body.player_name || "Unknown Player";
    const itemName = req.body.itemName || req.body.item_name || req.body["Item Name"] || req.body.item || (Array.isArray(req.body.items) ? req.body.items.join(", ") : req.body.items) || "Unknown Item";
    const price = req.body.price || req.body.Price || req.body.amount || req.body.total || "0";

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env["DISCORD WEBHOOK URL"] || process.env.DISCORD_WEBHOOK || process.env.discord_webhook;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is missing.");
      return res.status(500).json({ 
        status: "error", 
        message: "DISCORD_WEBHOOK_URL / DISCORD WEBHOOK URL environment variable is not defined in the applet's settings." 
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: "⚡ Successful Checkout!",
              description: "A secure Vercel store purchase event was processed.",
              color: 0xDC2626, // Solid red border color (#DC2626) to match the site's theme
              fields: [
                {
                  name: "👤 Player Username",
                  value: `\`\`\`${username}\`\`\``,
                  inline: true
                },
                {
                  name: "🎁 Bought Item",
                  value: `\`\`\`${itemName}\`\`\``,
                  inline: true
                },
                {
                  name: "💰 Price",
                  value: `\`\`\`${price}\`\`\``,
                  inline: true
                }
              ],
              timestamp: new Date().toISOString(),
              footer: {
                text: "Knockers SMP - Dynamic Vercel Checkout",
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Discord Webhook API error details:", errorText);
        return res.status(500).json({ status: "error", message: "Failed to dispatch notification to Discord webhook" });
      }

      res.json({ status: "ok", message: "Discord webhook notification dispatched successfully!" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ status: "error", message: "Internal server error during Discord Webhook dispatch" });
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


