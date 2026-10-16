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

async function analyze() {
  const { apiKey, model } = await chrome.storage.sync.get(['apiKey','model']);
  if (!apiKey) { showState('no-key'); return; }

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
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://clearsign.app',
        'X-Title': 'ClearSign'
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1200
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }

    const data = await resp.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    renderSections(parsed.sections);
    setRiskBadge(parsed.overall_risk);
    showState('result');

    await chrome.storage.local.set({
      lastResult: { sections: parsed.sections, overall_risk: parsed.overall_risk, url: location.href, ts: Date.now() }
    });
  } catch (e) {
    showState('error');
    $('error-text').textContent = e.message || 'Something went wrong.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) { showState('no-key'); return; }

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
