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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/notify-purchase", async (req, res) => {
    // Extract playerName, itemName, and price from req.body, with fallbacks for alternative formats
    const playerName = req.body.playerName || req.body.username || req.body.player_name || "Unknown Player";
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
                  name: "📝 Player Bio",
                  value: `\`\`\`${playerBio}\`\`\``,
                  inline: true
                },
                {
                   // Adding an empty space to force the next fields below or keep them inline depending on Discord layout
                  name: "\u200b",
                  value: "\u200b",
                  inline: false
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
                  name: "📝 Player Bio",
                  value: `\`\`\`${playerBio}\`\`\``,
                  inline: true
                },
                {
                   // Adding an empty space to force the next fields below or keep them inline depending on Discord layout
                  name: "\u200b",
                  value: "\u200b",
                  inline: false
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


