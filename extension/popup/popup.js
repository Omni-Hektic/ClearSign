const $ = id => document.getElementById(id);

const states = ['idle','loading','result','error','no-key'];
function showState(name) {
  states.forEach(s => $('state-' + s).classList.add('hidden'));
  $('state-' + name).classList.remove('hidden');
}

function setRiskBadge(level) {
  const badge = $('risk-badge');
  badge.classList.remove('hidden','green','yellow','red');
  const labels = { low: ['green','Low Risk'], medium: ['yellow','Medium Risk'], high: ['red','High Risk'] };
  const [cls, text] = labels[level] || ['yellow','Unknown'];
  badge.classList.add(cls);
  badge.textContent = text;
}

function renderSections(sections) {
  const container = $('summary-sections');
  container.innerHTML = '';
  sections.forEach(({ label, text, risk }) => {
    const div = document.createElement('div');
    div.className = 'section' + (risk ? ' risk-' + risk : '');
    div.innerHTML = `<div class="section-label">${label}</div><div class="section-text">${text}</div>`;
    container.appendChild(div);
  });
}

async function callOpenRouter(apiKey, model, prompt) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clearsign.app',
      'X-Title': 'ClearSign'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1200
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenRouter error ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function callGroq(apiKey, model, prompt) {
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1200
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq error ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function callBedrock(awsKeyId, awsSecret, awsRegion, model, prompt) {
  const body = JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    anthropic_version: 'bedrock-2023-05-31'
  });

  const endpoint = `https://bedrock-runtime.${awsRegion}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`;
  const date = new Date();
  const dateStr = date.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateOnly = dateStr.slice(0, 8);

  // AWS SigV4 signing via background service worker
  const resp = await chrome.runtime.sendMessage({
    type: 'BEDROCK_INVOKE',
    endpoint, body, awsKeyId, awsSecret, awsRegion, model
  });

  if (resp.error) throw new Error(resp.error);
  const result = JSON.parse(resp.body);
  return result.content?.[0]?.text || result.completion || '';
}

async function analyze() {
  const cfg = await chrome.storage.sync.get([
    'provider', 'orKey', 'orModel',
    'groqKey', 'groqModel',
    'awsKeyId', 'awsSecret', 'awsRegion', 'bedrockModel'
  ]);

  const provider = cfg.provider || 'openrouter';
  const hasKey = (provider === 'openrouter' && cfg.orKey) ||
                 (provider === 'groq' && cfg.groqKey) ||
                 (provider === 'bedrock' && cfg.awsKeyId && cfg.awsSecret);

  if (!hasKey) { showState('no-key'); return; }

  showState('loading');
  $('risk-badge').classList.add('hidden');

  let pageText;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 12000)
    });
    pageText = results[0].result;
  } catch (e) {
    showState('error');
    $('error-text').textContent = 'Could not read page content.';
    return;
  }

  const prompt = `You are a legal document analyzer. Summarize the following document for a non-lawyer.

Return a JSON object with this exact shape:
{
  "overall_risk": "low" | "medium" | "high",
  "sections": [
    { "label": "string", "text": "plain English summary", "risk": "low" | "medium" | "high" | null }
  ]
}

Cover: data collection, data sharing with third parties, cancellation/refunds, arbitration/dispute resolution, auto-renewal, liability limits, and any unusually aggressive clauses.

Document:
${pageText}`;

  try {
    let raw;
    if (provider === 'openrouter') {
      raw = await callOpenRouter(cfg.orKey, cfg.orModel || 'openai/gpt-4o-mini', prompt);
    } else if (provider === 'groq') {
      raw = await callGroq(cfg.groqKey, cfg.groqModel || 'llama-3.3-70b-versatile', prompt);
    } else if (provider === 'bedrock') {
      raw = await callBedrock(cfg.awsKeyId, cfg.awsSecret, cfg.awsRegion || 'us-east-1', cfg.bedrockModel || 'anthropic.claude-3-5-sonnet-20241022-v2:0', prompt);
    }

    const parsed = JSON.parse(raw);
    renderSections(parsed.sections);
    setRiskBadge(parsed.overall_risk);
    showState('result');

    await chrome.storage.local.set({
      lastResult: { sections: parsed.sections, overall_risk: parsed.overall_risk, ts: Date.now() }
    });
  } catch (e) {
    showState('error');
    $('error-text').textContent = e.message || 'Something went wrong.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get(['provider','orKey','groqKey','awsKeyId','awsSecret']);
  const provider = cfg.provider || 'openrouter';
  const hasKey = (provider === 'openrouter' && cfg.orKey) ||
                 (provider === 'groq' && cfg.groqKey) ||
                 (provider === 'bedrock' && cfg.awsKeyId && cfg.awsSecret);
  if (!hasKey) { showState('no-key'); return; }

  const cached = await chrome.storage.local.get('lastResult');
  if (cached.lastResult && Date.now() - cached.lastResult.ts < 5 * 60 * 1000) {
    renderSections(cached.lastResult.sections);
    setRiskBadge(cached.lastResult.overall_risk);
    showState('result');
  } else {
    showState('idle');
  }
});

$('btn-analyze').addEventListener('click', analyze);
$('btn-reanalyze').addEventListener('click', analyze);
$('btn-retry').addEventListener('click', analyze);
$('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('btn-copy').addEventListener('click', async () => {
  const text = Array.from(document.querySelectorAll('.section'))
    .map(s => s.querySelector('.section-label').textContent + ': ' + s.querySelector('.section-text').textContent)
    .join('\n\n');
  await navigator.clipboard.writeText(text);
  $('btn-copy').textContent = 'Copied!';
  setTimeout(() => { $('btn-copy').textContent = 'Copy Summary'; }, 1500);
});
