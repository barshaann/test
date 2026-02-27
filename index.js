const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json({ limit: '10mb' }));

let cachedToken = null;
let tokenExpiry = 0;

// Internal Security Key (Matches your Supabase secret)
const APP_INTERNAL_SECRET = process.env.APP_INTERNAL_SECRET;

// 1. OAuth 2.0 Token Manager
async function getAuthToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(`${process.env.FS_CLIENT_ID}:${process.env.FS_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://oauth.fatsecret.com/connect/token', 
    'grant_type=client_credentials&scope=basic image-recognition', 
    { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = now + response.data.expires_in - 60;
  return cachedToken;
}

// 2. Food Recognition Endpoint
app.post('/recognize', async (req, res) => {
  // Security Check
  if (req.headers['x-app-secret'] !== APP_INTERNAL_SECRET) return res.status(401).send("Unauthorized");

  try {
    const token = await getAuthToken();
    const fsResponse = await axios.post('https://platform.fatsecret.com/rest/server.api', null, {
      params: { method: 'image.recognition.v2', format: 'json' },
      data: { image_b64: req.body.image },
      headers: { 'Authorization': `Bearer ${token}` }
    });
    res.json(fsResponse.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
