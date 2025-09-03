// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors()); // file:// でもOKにする

// Renderにデプロイする時は環境変数に設定しておくと便利
const INVIDIOUS_INSTANCE = process.env.INVIDIOUS_INSTANCE || "https://yewtu.be";

// 🔍 検索API
app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const url = `${INVIDIOUS_INSTANCE}/api/v1/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch search results" });
  }
});

// 🎥 動画MP4取得
app.get("/video", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing video id" });

  try {
    const url = `${INVIDIOUS_INSTANCE}/api/v1/videos/${id}`;
    const response = await fetch(url);
    const data = await response.json();

    // MP4優先でitagを探す
    const mp4Stream = data.formatStreams?.find(
      s => s.type.includes("mp4") && s.url
    );

    if (!mp4Stream) {
      return res.status(404).json({ error: "No MP4 stream found" });
    }

    res.json({ url: mp4Stream.url });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch video" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
