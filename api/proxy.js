module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Collect raw body
    let rawBody = '';
    
    for await (const chunk of req) {
      rawBody += chunk.toString();
    }

    let action = 'create';
let zone, token, subdomain, ip, proxied, record_id;

    // Parse based on content type
    if (contentType.includes('application/json')) {
  const body = JSON.parse(rawBody);

  action = body?.action || 'create';
  record_id = body?.record_id || '';

  zone = body?.zone || '';
  token = body?.token || '';
  subdomain = body?.subdomain || '';
  ip = body?.ip || '';

  proxied = body?.proxied === 'true' || body?.proxied === true;
}
      
      proxied = body?.proxied === 'true' || body?.proxied === true;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody);

action = params.get('action') || 'create';
record_id = params.get('record_id') || '';
      zone = params.get('zone') || '';
      token = params.get('token') || '';
      subdomain = params.get('subdomain') || '';
      ip = params.get('ip') || '';
      proxied = params.get('proxied') === 'true';
    } else if (contentType.includes('multipart/form-data')) {
      // FormData - parse boundary
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return res.status(400).json({
          success: false,
          errors: [{ message: 'Invalid multipart boundary' }]
        });
      }

      const parts = rawBody.split(`--${boundary}`);
      
      for (const part of parts) {
        if (part.includes('name="zone"')) {
          const match = part.match(/name="zone"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          zone = match ? match[1].trim() : '';
        }
        if (part.includes('name="token"')) {
          const match = part.match(/name="token"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          token = match ? match[1].trim() : '';
        }
        if (part.includes('name="subdomain"')) {
          const match = part.match(/name="subdomain"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          subdomain = match ? match[1].trim() : '';
        }
        if (part.includes('name="ip"')) {
          const match = part.match(/name="ip"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          ip = match ? match[1].trim() : '';
        }
        if (part.includes('name="action"')) {
          const match = part.match(/name="action"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          action = match ? match[1].trim() : 'create';
       }

        if (part.includes('name="record_id"')) {
          const match = part.match(/name="record_id"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
         record_id = match ? match[1].trim() : '';
       }
        if (part.includes('name="proxied"')) {
          const match = part.match(/name="proxied"[^\r\n]*\r\n\r\n([\s\S]*?)\r\n/);
          proxied = match ? match[1].trim() === 'true' : false;
        }
      }
    }

    // Validasi
    if (!zone || !token) {
  return res.status(400).json({
    success: false,
    errors: [{ message: 'Zone ID dan Token wajib diisi' }]
  });
}

    // Step 1: Get domain from Zone ID
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const zoneData = await zoneRes.json().catch(() => null);

    if (!zoneRes.ok || !zoneData) {
      return res.status(zoneRes.status).json(
        zoneData || { 
          success: false, 
          errors: [{ message: `Zone ID tidak valid atau Token salah. HTTP: ${zoneRes.status}` }] 
        }
      );
    }

    if (action === 'create') {

  if (!subdomain || !ip) {
    return res.status(400).json({
      success: false,
      errors: [{ message: 'Subdomain dan IP wajib diisi' }]
    });
  }

    }

    if (action === 'delete') {

  if (!record_id) {
    return res.status(400).json({
      success: false,
      errors: [{ message: 'Record ID wajib diisi' }]
    });
  }

    }

    if (!zoneData.success) {
      return res.status(400).json(zoneData);
    }

    
if (action === 'list') {

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/dns_records`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await cfRes.json();

  return res.status(cfRes.status).json(data);
}

if (action === 'delete') {

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/dns_records/${record_id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await cfRes.json();

  return res.status(cfRes.status).json(data);
}
    const domain = zoneData.result.name;
    const fullName = `${subdomain}.${domain}`;

    // Step 2: Create DNS record
    const dnsRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'A',
          name: fullName,
          content: ip,
          ttl: 120,
          proxied: proxied
        })
      }
    );

    const dnsData = await dnsRes.json().catch(() => null);
    
    if (!dnsData) {
      return res.status(500).json({
        success: false,
        errors: [{ message: 'Invalid response from Cloudflare' }]
      });
    }

    res.status(dnsRes.status).json(dnsData);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      errors: [{ message: error.message || 'Internal server error' }]
    });
  }
};
