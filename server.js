import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Invidiousインスタンス (環境変数で差し替え可能)
const INVIDIOUS = process.env.INVIDIOUS_INSTANCE || "https://iv.melmac.space";

app.use(cors());

// 動画情報取得
app.get("/api/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    const url = `${INVIDIOUS}/api/v1/videos/${videoId}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(500).json({ error: `Failed to fetch video info (${response.status})` });
    }

    const data = await response.json();

    // MP4リンクを探す
    let mp4Stream =
      data.formatStreams?.find(s => s.itag === 18) ||
      data.formatStreams?.find(s => s.mimeType?.includes("video/mp4")) ||
      data.adaptiveFormats?.find(s => s.mimeType?.includes("video/mp4"));

    if (!mp4Stream) {
      return res.status(404).json({ error: "MP4 stream not found", available: { formatStreams: data.formatStreams, adaptiveFormats: data.adaptiveFormats } });
    }

    res.json({ videoUrl: mp4Stream.url });
  } catch (e) {
    console.error("Error fetching video:", e);
    res.status(500).json({ error: "Server error", details: e.message });
  }
});

// 動画を中継する（オプション：CORS回避用）
app.get("/proxy-video", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Missing url param" });

    const response = await fetch(videoUrl);
    if (!response.ok) return res.status(500).json({ error: "Failed to fetch video stream" });

    res.setHeader("Content-Type", "video/mp4");
    response.body.pipe(res);
  } catch (e) {
    console.error("Proxy error:", e);
    res.status(500).json({ error: "Proxy error", details: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
