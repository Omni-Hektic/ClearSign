async function load() {
  const { apiKey, model, budget } = await chrome.storage.sync.get(['apiKey','model','budget']);
  if (apiKey) document.getElementById('apiKey').value = apiKey;
  if (model)  document.getElementById('model').value  = model;
  if (budget !== undefined) document.getElementById('budget').value = budget;
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const model  = document.getElementById('model').value;
  const budget = parseFloat(document.getElementById('budget').value) || 0;

  await chrome.storage.sync.set({ apiKey, model, budget });

  const status = document.getElementById('save-status');
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2000);
});

load();
