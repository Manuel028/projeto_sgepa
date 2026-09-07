const API_URL = 'http://localhost:3000/api';
const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const appMessage = document.querySelector('#appMessage');

function getToken() { return localStorage.getItem('sgepa_token'); }
function showMessage(message, target = appMessage) { target.textContent = message || ''; }
function showApp() { loginView.classList.add('hidden'); appView.classList.remove('hidden'); }
function showLogin() { appView.classList.add('hidden'); loginView.classList.remove('hidden'); }

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}

async function loadSenders() {
  const senders = await api('/senders');
  const select = document.querySelector('#senderId');
  select.innerHTML = '<option value="">Seleccione um remetente</option>' + senders.map((sender) => `<option value="${sender.id}">${escapeHtml(sender.name)}</option>`).join('');
}

async function loadProcesses() {
  const processes = await api('/processes');
  document.querySelector('#totalProcesses').textContent = processes.length;
  document.querySelector('#inRouting').textContent = processes.filter((item) => item.state === 'EM_TRAMITACAO').length;
  document.querySelector('#awaitingDispatch').textContent = processes.filter((item) => item.state === 'AGUARDA_DESPACHO').length;
  document.querySelector('#processTable').innerHTML = processes.map((item) => `<tr><td>${escapeHtml(item.number)}</td><td>${escapeHtml(item.subject)}</td><td>${escapeHtml(item.sender_name)}</td><td><span class="state">${escapeHtml(item.state.replaceAll('_', ' '))}</span></td><td>${escapeHtml(item.priority)}</td><td>${new Date(item.created_at).toLocaleDateString('pt-PT')}</td></tr>`).join('') || '<tr><td colspan="6">Ainda não existem expedientes registados.</td></tr>';
}

function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value || ''; return element.innerHTML; }

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/auth/login', { method: 'POST', headers: {}, body: JSON.stringify(Object.fromEntries(form)) });
    localStorage.setItem('sgepa_token', data.token);
    localStorage.setItem('sgepa_user', JSON.stringify(data.user));
    showApp(); document.querySelector('#userName').textContent = data.user.name;
    await Promise.all([loadSenders(), loadProcesses()]);
  } catch (error) { showMessage(error.message, document.querySelector('#loginMessage')); }
});

document.querySelector('#senderForm').addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage('');
  try { await api('/senders', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await loadSenders(); showMessage('Remetente guardado com sucesso.'); }
  catch (error) { showMessage(error.message); }
});

document.querySelector('#processForm').addEventListener('submit', async (event) => {
  event.preventDefault(); showMessage('');
  try { const data = await api('/processes', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await loadProcesses(); showMessage(`Expediente ${data.number} registado com sucesso.`); }
  catch (error) { showMessage(error.message); }
});

document.querySelector('#refreshButton').addEventListener('click', () => loadProcesses().catch((error) => showMessage(error.message)));
document.querySelector('#logoutButton').addEventListener('click', () => { localStorage.removeItem('sgepa_token'); localStorage.removeItem('sgepa_user'); showLogin(); });

if (getToken()) {
  const user = JSON.parse(localStorage.getItem('sgepa_user') || '{}');
  document.querySelector('#userName').textContent = user.name || 'Utilizador'; showApp();
  Promise.all([loadSenders(), loadProcesses()]).catch(() => { localStorage.clear(); showLogin(); });
}

