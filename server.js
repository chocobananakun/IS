import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// フェイルオーバー用 Invidious インスタンス複数
const INVIDIOUS_INSTANCES = [
  "https://iv.melmac.space",
  "https://yewtu.be",
  "https://invidious.snopyta.org",
  "https://vid.puffyan.us"
];

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// JSON取得＋フェイルオーバー
async function fetchJSONWithFailover(path, retries = 3) {
  for (const instance of INVIDIOUS_INSTANCES) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const url = `${instance}${path}`;
        const res = await fetch(url);
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) break; // ステータスエラーなら次インスタンス
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
  const videoId = req.params.id;
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJSONWithFailover(`/api/v1/videos/${videoId}`);
      
      // MP4ストリームを探す
      let mp4Stream =
        data.formatStreams?.find(s => Number(s.itag) === 18) ||
        data.formatStreams?.find(s => s.mimeType?.includes("video/mp4")) ||
        data.adaptiveFormats?.find(s => s.mimeType?.includes("video/mp4"));

      if (mp4Stream) {
        return res.json({ videoUrl: mp4Stream.url });
      }
      // なければ次のインスタンスへ
    } catch(e) {
      // 次のインスタンスに切り替え
    }
  }
  res.status(500).json({ error: "MP4 stream not found on all instances" });
});

// 検索 API
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query param" });

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJSONWithFailover(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const results = data.map(item => ({
        videoId: item.videoId,
        title: item.title
      }));
      return res.json({ results });
    } catch(e) {
      // 次のインスタンスに切り替え
    }
  }
  res.status(500).json({ error: "Failed to fetch search results on all instances" });
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

// ルートアクセスで HTML を返す
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
