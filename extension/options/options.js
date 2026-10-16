function switchProvider() {
  const provider = document.getElementById('provider').value;
  document.querySelectorAll('.provider-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + provider).classList.add('active');
}

async function load() {
  const data = await chrome.storage.sync.get([
    'provider',
    'orKey', 'orModel',
    'groqKey', 'groqModel',
    'awsKeyId', 'awsSecret', 'awsRegion', 'bedrockModel',
    'budget'
  ]);

  if (data.provider) {
    document.getElementById('provider').value = data.provider;
    switchProvider();
  }
  if (data.orKey)       document.getElementById('orKey').value       = data.orKey;
  if (data.orModel)     document.getElementById('orModel').value     = data.orModel;
  if (data.groqKey)     document.getElementById('groqKey').value     = data.groqKey;
  if (data.groqModel)   document.getElementById('groqModel').value   = data.groqModel;
  if (data.awsKeyId)    document.getElementById('awsKeyId').value    = data.awsKeyId;
  if (data.awsSecret)   document.getElementById('awsSecret').value   = data.awsSecret;
  if (data.awsRegion)   document.getElementById('awsRegion').value   = data.awsRegion;
  if (data.bedrockModel)document.getElementById('bedrockModel').value= data.bedrockModel;
  if (data.budget !== undefined) document.getElementById('budget').value = data.budget;
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const provider = document.getElementById('provider').value;
  await chrome.storage.sync.set({
    provider,
    orKey:        document.getElementById('orKey').value.trim(),
    orModel:      document.getElementById('orModel').value,
    groqKey:      document.getElementById('groqKey').value.trim(),
    groqModel:    document.getElementById('groqModel').value,
    awsKeyId:     document.getElementById('awsKeyId').value.trim(),
    awsSecret:    document.getElementById('awsSecret').value.trim(),
    awsRegion:    document.getElementById('awsRegion').value,
    bedrockModel: document.getElementById('bedrockModel').value,
    budget:       parseFloat(document.getElementById('budget').value) || 0
  });

  const status = document.getElementById('save-status');
  status.classList.add('show');
  setTimeout(() => status.classList.remove('show'), 2000);
});

load();
