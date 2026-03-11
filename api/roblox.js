// Vercel Serverless Function — Roblox API Proxy
// Proxies requests to Roblox public APIs, handling CORS

const ALLOWED_SUBDOMAINS = ['users', 'presence', 'thumbnails', 'friends', 'games'];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { subdomain, path } = req.query;

  if (!subdomain || !path) {
    return res.status(400).json({ error: 'Missing subdomain or path query parameters' });
  }

  if (!ALLOWED_SUBDOMAINS.includes(subdomain)) {
    return res.status(403).json({ error: `Subdomain "${subdomain}" is not allowed` });
  }

  const targetUrl = `https://${subdomain}.roblox.com/${path}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com',
      },
    };

    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Roblox proxy error:', error);
    return res.status(500).json({ error: 'Failed to proxy request to Roblox API' });
  }
}
