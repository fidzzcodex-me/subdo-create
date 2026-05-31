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

  const { zone, token, subdomain, ip, proxied } = req.body;

  // Validasi
  if (!zone || !token || !subdomain || !ip) {
    return res.status(400).json({
      success: false,
      errors: [{ message: 'Zone ID, Token, Subdomain, IP wajib diisi' }]
    });
  }

  try {
    // Step 1: Get domain from Zone ID
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!zoneRes.ok) {
      const errorData = await zoneRes.json().catch(() => ({}));
      return res.status(zoneRes.status).json(
        errorData || { 
          success: false, 
          errors: [{ message: `Zone ID tidak valid atau Token salah. HTTP: ${zoneRes.status}` }] 
        }
      );
    }

    const zoneData = await zoneRes.json();
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
          proxied: proxied === 'true' || proxied === true
        })
      }
    );

    const dnsData = await dnsRes.json();
    res.status(dnsRes.status).json(dnsData);

  } catch (error) {
    res.status(500).json({
      success: false,
      errors: [{ message: error.message }]
    });
  }
};
