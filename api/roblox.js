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
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
      },
    };

    // Only set Content-Type for POST requests
    if (req.method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      if (req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Try to parse JSON, return raw text if that fails
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Roblox proxy error:', error);
    return res.status(500).json({ error: 'Failed to proxy request to Roblox API' });
  }
}
