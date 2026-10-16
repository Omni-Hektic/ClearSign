chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'LEGAL_PAGE_DETECTED') {
    chrome.action.setBadgeText({ text: '!', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#6c8cff', tabId: sender.tab.id });
  }

  if (msg.type === 'BEDROCK_INVOKE') {
    invokeBedrock(msg).then(result => {
      chrome.tabs.sendMessage(sender.tab?.id, result);
    });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

async function sha256hex(data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, data) {
  const k = key instanceof CryptoKey ? key : await crypto.subtle.importKey(
    'raw', typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function getSigningKey(secretKey, dateOnly, region, service) {
  const kDate    = await hmacSha256('AWS4' + secretKey, dateOnly);
  const kRegion  = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function invokeBedrock({ endpoint, body, awsKeyId, awsSecret, awsRegion, model }) {
  try {
    const service = 'bedrock';
    const now = new Date();
    const amzDate  = now.toISOString().replace(/[:-]/g, '').replace(/\.\d+/, '');
    const dateOnly = amzDate.slice(0, 8);
    const host = `bedrock-runtime.${awsRegion}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(model)}/invoke`;

    const bodyHash = await sha256hex(body);
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

    const credentialScope = `${dateOnly}/${awsRegion}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256hex(canonicalRequest)].join('\n');

    const signingKey = await getSigningKey(awsSecret, dateOnly, awsRegion, service);
    const sigKey = await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBytes = await crypto.subtle.sign('HMAC', sigKey, new TextEncoder().encode(stringToSign));
    const signature = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${awsKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authHeader
      },
      body
    });

    const text = await resp.text();
    if (!resp.ok) return { error: `Bedrock error ${resp.status}: ${text}` };
    return { body: text };
  } catch (e) {
    return { error: e.message };
  }
}
