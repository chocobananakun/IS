import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 安定した Invidious インスタンス
const INVIDIOUS = process.env.INVIDIOUS_INSTANCE || "https://iv.melmac.space";

app.use(cors());

// HTML/JS/CSS を public フォルダから配信
app.use(express.static(path.join(__dirname, "public")));

// JSON を返すか確認してフェイルオーバー
async function fetchJSONWithFailover(path, retries = 3) {
  for (const instance of INVIDIOUS_INSTANCES) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const url = `${instance}${path}`;
        const res = await fetch(url);
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) break;
        if (!contentType.includes("application/json")) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        return await res.json();
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw new Error("All Invidious instances failed");
}

// 動画情報取得
app.get("/api/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    const data = await fetchJSONWithFailover(`/api/v1/videos/${videoId}`);

    let mp4Stream =
      data.formatStreams?.find(s => Number(s.itag) === 18) ||
      data.formatStreams?.find(s => s.mimeType?.includes("video/mp4")) ||
      data.adaptiveFormats?.find(s => s.mimeType?.includes("video/mp4"));

    if (!mp4Stream) return res.status(404).json({ error: "MP4 stream not found" });

    res.json({ videoUrl: mp4Stream.url });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch video info", details: e.message });
  }
});

// 検索 API
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Missing query param" });

    const data = await fetchJSONWithFailover(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);

    const results = data.map(item => ({
      videoId: item.videoId,
      title: item.title
    }));

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch search results", details: e.message });
  }
});

// Proxy 動画再生
app.get("/proxy-video", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "Missing url param" });

    const response = await fetch(videoUrl);
    if (!response.ok) return res.status(500).json({ error: "Failed to fetch video stream" });

    res.setHeader("Content-Type", "video/mp4");
    response.body.pipe(res);
  } catch (e) {
    res.status(500).json({ error: "Proxy error", details: e.message });
  }
});

// サーバールートにアクセスしたら index.html を返す
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
