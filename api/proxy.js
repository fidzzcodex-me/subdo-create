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
    // Parse FormData atau JSON body
    let zone, token, subdomain, ip, proxied;

    if (req.headers['content-type']?.includes('application/json')) {
      // JSON body
      zone = req.body?.zone || '';
      token = req.body?.token || '';
      subdomain = req.body?.subdomain || '';
      ip = req.body?.ip || '';
      proxied = req.body?.proxied === 'true' || req.body?.proxied === true;
    } else {
      // FormData - parse manually dari string body
      const body = typeof req.body === 'string' ? req.body : Buffer.from(req.body || '').toString();
      const params = new URLSearchParams(body);
      zone = params.get('zone') || '';
      token = params.get('token') || '';
      subdomain = params.get('subdomain') || '';
      ip = params.get('ip') || '';
      proxied = params.get('proxied') === 'true';
    }

    // Validasi
    if (!zone || !token || !subdomain || !ip) {
      return res.status(400).json({
        success: false,
        errors: [{ message: 'Zone ID, Token, Subdomain, IP wajib diisi' }]
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

    if (!zoneData.success) {
      return res.status(400).json(zoneData);
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
