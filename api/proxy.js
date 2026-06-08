module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    // ── parse body ──────────────────────────────────────────────────────────
    let rawBody = '';
    for await (const chunk of req) rawBody += chunk.toString();

    let body = {};
    const ct = req.headers['content-type'] || '';
    if (ct.includes('application/json')) {
      body = JSON.parse(rawBody);
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const p = new URLSearchParams(rawBody);
      for (const [k, v] of p) body[k] = v;
    }

    const { zone, token, _action } = body;
    if (!zone || !token) {
      return res.status(400).json({ success: false, errors: [{ message: 'Zone ID and Token are required' }] });
    }

    const CF = 'https://api.cloudflare.com/client/v4';
    const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const zid = encodeURIComponent(zone);

    const cfGet  = (path) => fetch(`${CF}${path}`, { headers: H });
    const cfPost = (path, data) => fetch(`${CF}${path}`, { method: 'POST', headers: H, body: JSON.stringify(data) });
    const cfPut  = (path, data) => fetch(`${CF}${path}`, { method: 'PUT', headers: H, body: JSON.stringify(data) });
    const cfPatch= (path, data) => fetch(`${CF}${path}`, { method: 'PATCH', headers: H, body: JSON.stringify(data) });
    const cfDel  = (path) => fetch(`${CF}${path}`, { method: 'DELETE', headers: H });
    const json   = async (r) => { const d = await r.json().catch(() => null); return [r.status, d]; };

    // ════════════════════════════════════════════════════════════════════════
    //  ZONE INFO
    // ════════════════════════════════════════════════════════════════════════
    if (_action === 'zoneInfo') {
      const [status, data] = await json(await cfGet(`/zones/${zid}`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response from Cloudflare' }] });
      return res.status(status).json(data);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  DNS RECORDS
    // ════════════════════════════════════════════════════════════════════════
    if (_action === 'list') {
      const [status, data] = await json(await cfGet(`/zones/${zid}/dns_records?per_page=100`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'delete') {
      const { recordId } = body;
      if (!recordId) return res.status(400).json({ success: false, errors: [{ message: 'recordId required' }] });
      const [status, data] = await json(await cfDel(`/zones/${zid}/dns_records/${encodeURIComponent(recordId)}`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'update') {
      const { recordId, name, content, ttl, proxied, type } = body;
      if (!recordId || !name || !content) return res.status(400).json({ success: false, errors: [{ message: 'recordId, name, content required' }] });
      const [status, data] = await json(await cfPatch(`/zones/${zid}/dns_records/${encodeURIComponent(recordId)}`, {
        name, content, ttl: parseInt(ttl) || 120,
        proxied: proxied === true || proxied === 'true',
        type: type || 'A',
      }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    // ── CREATE DNS (default / no _action) ───────────────────────────────────
    if (!_action) {
      let { subdomain, ip, proxied, ttl, type } = body;
      if (!subdomain || !ip) return res.status(400).json({ success: false, errors: [{ message: 'subdomain and ip/content required' }] });

      const [zStatus, zData] = await json(await cfGet(`/zones/${zid}`));
      if (!zData?.success) return res.status(zStatus).json(zData || { success: false, errors: [{ message: `Zone invalid. HTTP: ${zStatus}` }] });

      const domain = zData.result.name;
      const fullName = `${subdomain}.${domain}`;
      const recordType = (type || 'A').toUpperCase();
      const canProxy = recordType === 'A' || recordType === 'AAAA';

      const [dStatus, dData] = await json(await cfPost(`/zones/${zid}/dns_records`, {
        type: recordType, name: fullName, content: ip,
        ttl: parseInt(ttl) || 120,
        proxied: canProxy ? (proxied === true || proxied === 'true') : false,
      }));
      if (!dData) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(dStatus).json(dData);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  EMAIL ROUTING
    // ════════════════════════════════════════════════════════════════════════
    if (_action === 'emailList') {
      const [status, data] = await json(await cfGet(`/zones/${zid}/email/routing/rules?per_page=50`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'emailCreate') {
      const { matchers, actions, enabled } = body;
      if (!matchers || !actions) return res.status(400).json({ success: false, errors: [{ message: 'matchers and actions required' }] });

      // Resolve domain name for specific address matchers
      if (matchers[0]?.type === 'literal') {
        const [, zData] = await json(await cfGet(`/zones/${zid}`));
        if (zData?.success) {
          const domain = zData.result.name;
          const val = matchers[0].value;
          // Replace placeholder domain with actual domain
          if (val.includes('@placeholder')) {
            matchers[0].value = val.replace('@placeholder', `@${domain}`);
          }
        }
      }

      const [status, data] = await json(await cfPost(`/zones/${zid}/email/routing/rules`, {
        matchers, actions, enabled: enabled !== false,
      }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'emailToggle') {
      const { tag, enabled } = body;
      if (!tag) return res.status(400).json({ success: false, errors: [{ message: 'tag required' }] });
      const [status, data] = await json(await cfPatch(`/zones/${zid}/email/routing/rules/${encodeURIComponent(tag)}`, { enabled }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'emailDelete') {
      const { tag } = body;
      if (!tag) return res.status(400).json({ success: false, errors: [{ message: 'tag required' }] });
      const [status, data] = await json(await cfDel(`/zones/${zid}/email/routing/rules/${encodeURIComponent(tag)}`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    // ── Destination Addresses ────────────────────────────────────────────────
    if (_action === 'emailDestList') {
      // Destination addresses live on account level — derive account id from zone
      const [, zData] = await json(await cfGet(`/zones/${zid}`));
      if (!zData?.success) return res.status(400).json({ success: false, errors: [{ message: 'Cannot resolve account from zone' }] });
      const accountId = zData.result.account?.id;
      if (!accountId) return res.status(400).json({ success: false, errors: [{ message: 'Account ID not found' }] });
      const [status, data] = await json(await cfGet(`/accounts/${encodeURIComponent(accountId)}/email/routing/addresses?per_page=50`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'emailDestCreate') {
      const { email } = body;
      if (!email) return res.status(400).json({ success: false, errors: [{ message: 'email required' }] });
      const [, zData] = await json(await cfGet(`/zones/${zid}`));
      if (!zData?.success) return res.status(400).json({ success: false, errors: [{ message: 'Cannot resolve account from zone' }] });
      const accountId = zData.result.account?.id;
      const [status, data] = await json(await cfPost(`/accounts/${encodeURIComponent(accountId)}/email/routing/addresses`, { email }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'emailDestDelete') {
      const { tag } = body;
      if (!tag) return res.status(400).json({ success: false, errors: [{ message: 'tag required' }] });
      const [, zData] = await json(await cfGet(`/zones/${zid}`));
      const accountId = zData?.result?.account?.id;
      const [status, data] = await json(await cfDel(`/accounts/${encodeURIComponent(accountId)}/email/routing/addresses/${encodeURIComponent(tag)}`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  SSL / TLS
    // ════════════════════════════════════════════════════════════════════════
    if (_action === 'sslMode') {
      const { value } = body;
      const modeMap = { off: 'off', flexible: 'flexible', full: 'full', strict: 'strict' };
      const mode = modeMap[value] || 'full';
      const [status, data] = await json(await cfPatch(`/zones/${zid}/settings/ssl`, { value: mode }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'sslToggle') {
      const { setting, value } = body;
      const allowed = ['always_use_https', 'automatic_https_rewrites', 'opportunistic_encryption', 'tls_1_3'];
      if (!allowed.includes(setting)) return res.status(400).json({ success: false, errors: [{ message: 'Invalid setting' }] });
      // tls_1_3 uses 'on'/'off', others use 'on'/'off' too
      const val = value === true || value === 'true' ? 'on' : 'off';
      const [status, data] = await json(await cfPatch(`/zones/${zid}/settings/${setting}`, { value: val }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'sslMinTLS') {
      const { value } = body;
      const allowed = ['1.0', '1.1', '1.2', '1.3'];
      if (!allowed.includes(value)) return res.status(400).json({ success: false, errors: [{ message: 'Invalid TLS version' }] });
      const [status, data] = await json(await cfPatch(`/zones/${zid}/settings/min_tls_version`, { value }));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    if (_action === 'sslCerts') {
      const [status, data] = await json(await cfGet(`/zones/${zid}/ssl/certificate_packs?per_page=20`));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(status).json(data);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  RULES
    // ════════════════════════════════════════════════════════════════════════
    // Endpoint map per rule type
    const RULE_ENDPOINTS = {
      redirect: `/zones/${zid}/rulesets/phases/http_request_dynamic_redirect/entrypoint`,
      transform: `/zones/${zid}/rulesets/phases/http_request_transform/entrypoint`,
      cache:     `/zones/${zid}/rulesets/phases/http_request_cache_settings/entrypoint`,
      origin:    `/zones/${zid}/rulesets/phases/http_request_origin/entrypoint`,
      security:  `/zones/${zid}/rulesets/phases/http_request_firewall_custom/entrypoint`,
    };

    if (_action === 'ruleList') {
      const { ruleType } = body;
      const endpoint = RULE_ENDPOINTS[ruleType];
      if (!endpoint) return res.status(400).json({ success: false, errors: [{ message: 'Invalid rule type' }] });
      const [status, data] = await json(await cfGet(endpoint));
      if (!data) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      // rules are nested inside ruleset
      if (data.success && data.result) {
        return res.status(status).json({ success: true, result: data.result.rules || [] });
      }
      // 404 means no ruleset yet = empty
      if (status === 404) return res.status(200).json({ success: true, result: [] });
      return res.status(status).json(data);
    }

    if (_action === 'ruleCreate') {
      const { ruleType, expression, target } = body;
      const endpoint = RULE_ENDPOINTS[ruleType];
      if (!endpoint) return res.status(400).json({ success: false, errors: [{ message: 'Invalid rule type' }] });

      // Build action based on rule type
      let action, action_parameters;
      if (ruleType === 'redirect') {
        action = 'redirect';
        const statusCode = parseInt(body.ruleStatus) || 302;
        action_parameters = {
          from_value: { status_code: statusCode, target_url: { value: target }, preserve_query_string: false }
        };
      } else if (ruleType === 'transform') {
        action = 'rewrite';
        const [headerName, ...headerValParts] = target.split(':');
        action_parameters = {
          headers: { [headerName.trim()]: { operation: 'set', value: headerValParts.join(':').trim() } }
        };
      } else if (ruleType === 'cache') {
        action = 'set_cache_settings';
        action_parameters = { edge_ttl: { mode: 'override_origin', default: parseInt(target) || 86400 } };
      } else if (ruleType === 'origin') {
        action = 'route';
        action_parameters = { origin: { host: target } };
      } else if (ruleType === 'security') {
        action = target; // block / challenge / allow / log / etc
        action_parameters = undefined;
      }

      const newRule = { expression, action, description: `CF Manager — ${ruleType}` };
      if (action_parameters) newRule.action_parameters = action_parameters;

      // First, try to GET the existing ruleset to append
      const [getStatus, getRuleset] = await json(await cfGet(endpoint));
      let finalData;

      if (getStatus === 200 && getRuleset?.success && getRuleset.result?.id) {
        // Ruleset exists — append rule via PUT
        const existing = getRuleset.result.rules || [];
        const [putStatus, putData] = await json(await cfPut(endpoint, {
          rules: [...existing, newRule]
        }));
        finalData = [putStatus, putData];
      } else {
        // No ruleset — create via POST to /rulesets
        const [postStatus, postData] = await json(await cfPost(`/zones/${zid}/rulesets`, {
          name: `CF Manager ${ruleType}`,
          kind: 'zone',
          phase: endpoint.split('/phases/')[1].split('/')[0],
          rules: [newRule]
        }));
        finalData = [postStatus, postData];
      }

      const [fStatus, fData] = finalData;
      if (!fData) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      if (fData.success) {
        const rules = fData.result?.rules || [];
        const created = rules[rules.length - 1];
        return res.status(fStatus).json({ success: true, result: created || fData.result });
      }
      return res.status(fStatus).json(fData);
    }

    if (_action === 'ruleDelete') {
      const { ruleType, ruleId } = body;
      const endpoint = RULE_ENDPOINTS[ruleType];
      if (!endpoint || !ruleId) return res.status(400).json({ success: false, errors: [{ message: 'ruleType and ruleId required' }] });

      // GET current ruleset
      const [, getRuleset] = await json(await cfGet(endpoint));
      if (!getRuleset?.success) return res.status(400).json({ success: false, errors: [{ message: 'Ruleset not found' }] });

      const remaining = (getRuleset.result?.rules || []).filter(r => r.id !== ruleId);
      const [putStatus, putData] = await json(await cfPut(endpoint, { rules: remaining }));
      if (!putData) return res.status(500).json({ success: false, errors: [{ message: 'Invalid response' }] });
      return res.status(putStatus).json({ success: putData.success, result: putData.result });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  UNKNOWN ACTION
    // ════════════════════════════════════════════════════════════════════════
    return res.status(400).json({ success: false, errors: [{ message: `Unknown action: ${_action}` }] });

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ success: false, errors: [{ message: error.message || 'Internal server error' }] });
  }
};
