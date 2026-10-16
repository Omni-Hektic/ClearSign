const LEGAL_PATTERNS = [
  /terms\s+of\s+(service|use)/i,
  /privacy\s+policy/i,
  /end\s+user\s+licen[sc]e/i,
  /cookie\s+policy/i,
  /user\s+agreement/i,
  /legal\s+notice/i,
  /data\s+processing\s+agreement/i,
  /acceptable\s+use\s+policy/i
];

function isLegalPage() {
  const title = document.title + ' ' + document.querySelector('h1')?.textContent || '';
  return LEGAL_PATTERNS.some(p => p.test(title));
}

if (isLegalPage()) {
  chrome.runtime.sendMessage({ type: 'LEGAL_PAGE_DETECTED', url: location.href });
}
