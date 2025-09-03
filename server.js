import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// 安定した Invidious インスタンスのリスト
const INVIDIOUS_INSTANCES = [
  "https://yewtu.be",
  "https://invidious.snopyta.org",
  "https://vid.puffyan.us"
];

app.use(cors());

// 再試行 + フェイルオーバー fetch
async function fetchWithFailover(path) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}${path}`;
      const res = await fetch(url);
      if (res.ok) return res;
      console.warn(`${instance} returned ${res.status}, trying next`);
    } catch (e) {
      console.warn(`${instance} fetch error: ${e.message}, trying next`);
    }
  }
  throw new Error("All Invidious instances failed");
}

// 動画情報取得
app.get("/api/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    const response = await fetchWithFailover(`/api/v1/videos/${videoId}`);
    const data = await response.json();

    // MP4 ストリームを探す
    let mp4Stream =
      data.formatStreams?.find(s => Number(s.itag) === 18) ||
      data.formatStreams?.find(s => s.mimeType?.includes("video/mp4")) ||
      data.adaptiveFormats?.find(s => s.mimeType?.includes("video/mp4"));

    if (!mp4Stream) {
      return res.status(404).json({
        error: "MP4 stream not found",
        available: {
          formatStreams: data.formatStreams,
          adaptiveFormats: data.adaptiveFormats
        }
      });
    }

    res.json({ videoUrl: mp4Stream.url });
  } catch (e) {
    console.error("Video fetch error:", e);
    res.status(500).json({ error: "Failed to fetch video info", details: e.message });
  }
});

// 検索 API
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Missing query param" });

    const response = await fetchWithFailover(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    const data = await response.json();

    const results = data.map(item => ({
      videoId: item.videoId,
      title: item.title
    }));

    res.json({ results });
  } catch (e) {
    console.error("Search error:", e);
    res.status(500).json({ error: "Failed to fetch search results", details: e.message });
  }
});

// Proxy 経由で動画中継（CORS回避）
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
  console.log(`Server running on port ${PORT}`);
});
