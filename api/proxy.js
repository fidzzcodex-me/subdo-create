module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    // ── parse body ──────────────────────────────────
    let rawBody = '';
    for await (const chunk of req) rawBody += chunk.toString();

    let body = {};
    const ct = req.headers['content-type'] || '';

    if (ct.includes('application/json')) {
      body = JSON.parse(rawBody);
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const p = new URLSearchParams(rawBody);
      for (const [k, v] of p) body[k] = v;
    } else if (ct.includes('multipart/form-data')) {
      const boundary = ct.split('boundary=')[1];
      if (!boundary) return res.status(400).json({ success: false, errors: [{ message: 'Invalid multipart boundary' }] });
      const parts = rawBody.split(`--${boundary}`);
      for (const part of parts) {
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) continue;
        const key = nameMatch[1];
        const valueMatch = part.match(/\r\n\r\n([\s\S]*?)\r\n$/);
        if (valueMatch) body[key] = valueMatch[1].trim();
      }
    }

    const { zone, token, _action } = body;

    if (!zone || !token) {
      return res.status(400).json({ success: false, errors: [{ message: 'Zone ID and Token are required' }] });
    }

    const CF = `https://api.cloudflare.com/client/v4`;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // ── ACTION: list records ─────────────────────────
    if (_action === 'list') {
      const r = await fetch(`${CF}/zones/${encodeURIComponent(zone)}/dns_records?per_page=100`, { headers });
      const data = await r.json().catch(() => null);
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response from Cloudflare' }] });
      return res.status(r.status).json(data);
    }

    // ── ACTION: delete record ────────────────────────
    if (_action === 'delete') {
      const { recordId } = body;
      if (!recordId) return res.status(400).json({ success: false, errors: [{ message: 'recordId is required' }] });
      const r = await fetch(`${CF}/zones/${encodeURIComponent(zone)}/dns_records/${encodeURIComponent(recordId)}`, {
        method: 'DELETE', headers
      });
      const data = await r.json().catch(() => null);
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response from Cloudflare' }] });
      return res.status(r.status).json(data);
    }

    // ── ACTION: update record ────────────────────────
    if (_action === 'update') {
      const { recordId, name, content, ttl, proxied, type } = body;
      if (!recordId || !name || !content) {
        return res.status(400).json({ success: false, errors: [{ message: 'recordId, name, content are required' }] });
      }
      const r = await fetch(`${CF}/zones/${encodeURIComponent(zone)}/dns_records/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          content,
          ttl: parseInt(ttl) || 120,
          proxied: proxied === true || proxied === 'true',
          type: type || 'A',
        })
      });
      const data = await r.json().catch(() => null);
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response from Cloudflare' }] });
      return res.status(r.status).json(data);
    }

    // ── ACTION: create record (default) ─────────────
    let { subdomain, ip, proxied, ttl, type } = body;
    if (!subdomain || !ip) {
      return res.status(400).json({ success: false, errors: [{ message: 'subdomain and ip/content are required' }] });
    }

    // Step 1 — resolve domain name from zone
    const zoneRes = await fetch(`${CF}/zones/${encodeURIComponent(zone)}`, { headers });
    const zoneData = await zoneRes.json().catch(() => null);
    if (!zoneRes.ok || !zoneData) {
      return res.status(zoneRes.status).json(
        zoneData || { success: false, errors: [{ message: `Zone ID invalid or Token wrong. HTTP: ${zoneRes.status}` }] }
      );
    }
    if (!zoneData.success) return res.status(400).json(zoneData);

    const domain = zoneData.result.name;
    const fullName = `${subdomain}.${domain}`;
    const recordType = (type || 'A').toUpperCase();
    const canProxy = recordType === 'A' || recordType === 'AAAA';

    // Step 2 — create DNS record
    const dnsRes = await fetch(`${CF}/zones/${encodeURIComponent(zone)}/dns_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: recordType,
        name: fullName,
        content: ip,
        ttl: parseInt(ttl) || 120,
        proxied: canProxy ? (proxied === true || proxied === 'true') : false,
      })
    });
    const dnsData = await dnsRes.json().catch(() => null);
    if (!dnsData) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response from Cloudflare' }] });
    return res.status(dnsRes.status).json(dnsData);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ success: false, errors: [{ message: error.message || 'Internal server error' }] });
  }
};
