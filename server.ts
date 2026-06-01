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
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("Discord configuration missing: DISCORD_WEBHOOK_URL is not set.");
      return res.status(500).json({ status: "error", message: "Internal Server Error" });
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
              title: "💰 New Purchase!",
              description: `**${playerName}** has just made a purchase in the Knockers SMP Store!`,
              color: 0xff0000, // SMP Red
              fields: [
                { name: "Items", value: items && items.length ? items.join(", ") : "Unknown Item", inline: true },
                { name: "Total Spent", value: `${amount || 0} Coins`, inline: true },
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
        const errorText = await response.text();
        console.error("Discord Webhook error details:", errorText);
        return res.status(500).json({ status: "error", message: "Failed to send notification" });
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Notification error:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });

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


