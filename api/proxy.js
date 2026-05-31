module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    let rawBody = '';
    for await (const chunk of req) rawBody += chunk.toString();

    const contentType = req.headers['content-type'] || '';
    let action = 'create';
    let zone, token, subdomain, ip, proxied = false, record_id;

    if (contentType.includes('application/json')) {
      const body = JSON.parse(rawBody);
      action = body?.action || 'create';
      record_id = body?.record_id || '';
      zone = body?.zone || '';
      token = body?.token || '';
      subdomain = body?.subdomain || '';
      ip = body?.ip || '';
      proxied = body?.proxied === true || body?.proxied === 'true';
    }
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);
      action = params.get('action') || 'create';
      record_id = params.get('record_id') || '';
      zone = params.get('zone') || '';
      token = params.get('token') || '';
      subdomain = params.get('subdomain') || '';
      ip = params.get('ip') || '';
      proxied = params.get('proxied') === 'true';
    }
    else if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return res.status(400).json({ success: false, errors: [{ message: 'Invalid multipart boundary' }] });

      const parts = rawBody.split(`--${boundary}`);
      const getVal = (name) => {
        const part = parts.find(p => p.includes(`name="${name}"`));
        if (!part) return '';
        const match = part.match(/name="[^"]+"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
        return match? match[1].trim() : '';
      };

      action = getVal('action') || 'create';
      record_id = getVal('record_id');
      zone = getVal('zone');
      token = getVal('token');
      subdomain = getVal('subdomain');
      ip = getVal('ip');
      proxied = getVal('proxied') === 'true';
    }
    else {
      // Ini saran si pler 👇 biar errornya jelas
      return res.status(400).json({
        success: false,
        errors: [{ message: 'Unsupported Content-Type. Use application/json or application/x-www-form-urlencoded' }]
      });
    }

    if (!zone ||!token) {
      return res.status(400).json({ success: false, errors: [{ message: 'Zone ID dan Token wajib diisi' }] });
    }

    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const zoneData = await zoneRes.json();

    if (!zoneRes.ok ||!zoneData.success) {
      return res.status(zoneRes.status).json(zoneData);
    }

    const domain = zoneData.result.name;

    if (action === 'list') {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    if (action === 'delete') {
      if (!record_id) return res.status(400).json({ success: false, errors: [{ message: 'Record ID wajib diisi' }] });
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records/${record_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    if (!subdomain ||!ip) {
      return res.status(400).json({ success: false, errors: [{ message: 'Subdomain dan IP wajib diisi' }] });
    }

    const fullName = `${subdomain}.${domain}`;
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'A', name: fullName, content: ip, ttl: 120, proxied })
    });

    const dnsData = await dnsRes.json();
    res.status(dnsRes.status).json(dnsData);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, errors: [{ message: error.message || 'Internal server error' }] });
  }
};
