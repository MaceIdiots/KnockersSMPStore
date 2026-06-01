import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function createServer() {
  const app = express();
  app.use(express.json());

  // API routes
  app.post("/api/notify-purchase", async (req, res) => {
    const { playerName, items, amount } = req.body;
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;

    if (!token || !channelId) {
      console.warn("Discord configuration (DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID) is missing in environment variables. Purchase transaction succeeded, Discord notify skipped.");
      return res.json({ 
        status: "warning", 
        message: "Discord notification skipped. Please define DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in Settings." 
      });
    }

    try {
      // Basic check for common misconfiguration (using bot ID as channel ID)
      if (token.includes(".")) {
        const botIdPart = token.split(".")[0];
        try {
          const decodedBotId = Buffer.from(botIdPart, 'base64').toString('utf8');
          if (decodedBotId === channelId) {
            console.warn("CRITICAL: DISCORD_CHANNEL_ID matches the Bot ID extracted from DISCORD_BOT_TOKEN. You likely used your Bot ID instead of a Channel ID.");
          }
        } catch (e) {
          // ignore decode errors
        }
      }

      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: "💰 New Purchase!",
              description: `**${playerName}** has just made a purchase in the Knockers SMP Store!`,
              color: 0xff0000, // SMP Red
              fields: [
                { name: "Items", value: items.join(", "), inline: true },
                { name: "Total Spent", value: `${amount} Coins`, inline: true },
              ],
              timestamp: new Date().toISOString(),
              footer: {
                text: "Knockers SMP Official Store",
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: "Could not parse response" };
        }
        console.error("Discord API error details:", JSON.stringify(errorData));
        
        // We log the error on the server but return 200 JSON with status warning/error info
        // so that the local storefront purchase flow is still fully completed.
        return res.json({ 
          status: "warning", 
          message: `Discord endpoint returned non-OK status (${response.status}). Purchase succeeded locally. Error: ${errorData.message || 'Unauthorized or bad channel request.'}` 
        });
      }

      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Notification error:", error);
      res.json({ 
        status: "warning", 
        message: `Network error of purchase notification: ${error.message || error}` 
      });
    }
  });

  // Webhook endpoints to handle successful checkout notifications via DISCORD_WEBHOOK_URL
  const handleCheckoutWebhook = async (req: express.Request, res: express.Response) => {
    // Collect player's [Username], [Item Name], and [Price] from request body
    const username = req.body.username || req.body.Username || req.body.playerName || req.body.player_name || "Unknown Player";
    const itemName = req.body.itemName || req.body.item_name || req.body["Item Name"] || req.body.item || (Array.isArray(req.body.items) ? req.body.items.join(", ") : req.body.items) || "Unknown Item";
    const price = req.body.price || req.body.Price || req.body.amount || req.body.total || "0";

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL environment variable is missing.");
      return res.status(500).json({ 
        status: "error", 
        message: "DISCORD_WEBHOOK_URL environment variable is not defined in the applet's settings." 
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

// For local development
if (process.env.NODE_ENV !== "production") {
  createServer().then(app => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default createServer();


