import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));
const PORT = process.env.PORT || 3000;

const INSTANCES = [
  "https://iv.melmac.space",
  "https://yewtu.be"
];

async function fetchWithFailover(path) {
  for (const instance of INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`);
      const data = await res.json();
      return data;
    } catch (e) {}
  }
  throw new Error("All instances failed");
}

app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    const data = await fetchWithFailover(`/api/v1/search?q=${encodeURIComponent(q)}`);
    const results = data.map(v => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.videoThumbnails?.[0]?.url || ""
    }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/video/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const data = await fetchWithFailover(`/api/v1/videos/${id}`);
    let stream = data.formatStreams?.find(s => s.mimeType?.includes("video/mp4"));
    if (!stream) stream = data.formatStreams?.find(s => s.mimeType?.includes("video/webm"));
    if (!stream) stream = data.formatStreams?.find(s => s.mimeType?.includes("dash"));
    if (!stream) return res.status(500).json({ error: "No playable stream found" });

    res.json({ videoUrl: stream.url, mimeType: stream.mimeType });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
