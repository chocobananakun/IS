// server.js
const express = require('express');
const fetch = require('node-fetch');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

const app = express();
const port = process.env.PORT || 3000;

// 環境変数でInvidiousインスタンスを指定可能
const INVIDIOUS_INSTANCE = process.env.INVIDIOUS_INSTANCE || 'https://iv.melmac.space';

// 動画情報を取得してMP4 URLを返すAPI（ブラウザ直接再生用）
app.get('/video', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

  try {
    const response = await fetch(`${INVIDIOUS_INSTANCE}/api/v1/videos/${videoId}`);
    const data = await response.json();

    const mp4Stream = data.formatStreams.find(stream => stream.itag === 18); // 360p MP4
    if (!mp4Stream) return res.status(404).json({ error: 'MP4 not found' });

    res.json({ url: mp4Stream.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// 動画をサーバー経由で中継するAPI（長時間安定再生用）
app.get('/proxy-video', async (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).send('Video ID required');

  try {
    const response = await fetch(`${INVIDIOUS_INSTANCE}/api/v1/videos/${videoId}`);
    const data = await response.json();

    const mp4Stream = data.formatStreams.find(stream => stream.itag === 18);
    if (!mp4Stream) return res.status(404).send('MP4 not found');

    const videoResp = await fetch(mp4Stream.url);
    res.setHeader('Content-Type', 'video/mp4');

    await streamPipeline(videoResp.body, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to proxy video');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
