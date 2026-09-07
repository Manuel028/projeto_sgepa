const API_URL = window.location.port === '3000' ? '/api' : 'http://localhost:3000/api';
const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const appMessage = document.querySelector('#appMessage');
let selectedProcessId = null;
let currentUser = null;
let activeFilters = {};
let adminRoles = [];
let adminPermissions = [];

function getToken() { return localStorage.getItem('sgepa_token'); }
function showMessage(message, target = appMessage, type = 'success') {
  target.textContent = message || '';
  if (!message) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<p>${escapeHtml(message)}</p><button type="button" aria-label="Fechar">×</button>`;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  document.querySelector('#toastContainer').append(toast);
  window.setTimeout(() => toast.remove(), 5000);
}
function showApp() { loginView.classList.add('hidden'); appView.classList.remove('hidden'); }
function showLogin() { appView.classList.add('hidden'); loginView.classList.remove('hidden'); }
function hasPermission(permission) { return currentUser?.permissions?.includes(permission); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value ?? ''; return element.innerHTML; }
function formatDate(value) { return value ? new Date(value).toLocaleString('pt-PT') : '—'; }
function stateLabel(value) { return (value || '').replaceAll('_', ' '); }

async function api(path, options = {}) {
  const headers = { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}

async function loadSenders() {
  if (!hasPermission('sender.read')) {
    document.querySelector('#senderForm').classList.add('hidden');
    document.querySelector('#processForm').classList.add('hidden');
    return;
  }
  const senders = await api('/senders');
  document.querySelector('#senderId').innerHTML = '<option value="">Seleccione um remetente</option>' + senders.map((sender) => `<option value="${sender.id}">${escapeHtml(sender.name)}</option>`).join('');
  document.querySelector('#senderForm').classList.toggle('hidden', !hasPermission('sender.create'));
  document.querySelector('#processForm').classList.toggle('hidden', !hasPermission('process.create'));
}

async function loadDepartments() {
  const departments = await api('/departments');
  const options = departments.map((department) => `<option value="${department.id}">${escapeHtml(department.name)}</option>`).join('');
  document.querySelector('#destinationDepartmentId').innerHTML = '<option value="">Seleccione o destino</option>' + options;
  document.querySelector('#searchDepartmentId').innerHTML = '<option value="">Todos</option>' + options;
}

async function loadArchiveUsers() {
  if (!hasPermission('archive.manage')) return;
  const users = await api('/users');
  document.querySelector('#loanRequesterId').innerHTML = '<option value="">Seleccione o solicitante</option>' + users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.username)})</option>`).join('');
}

async function loadProcesses(filters = activeFilters) {
  activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const query = new URLSearchParams(activeFilters).toString();
  const processes = await api(`/processes${query ? `?${query}` : ''}`);
  document.querySelector('#totalProcesses').textContent = processes.length;
  document.querySelector('#inRouting').textContent = processes.filter((item) => item.state === 'EM_TRAMITACAO').length;
  document.querySelector('#awaitingDispatch').textContent = processes.filter((item) => item.state === 'AGUARDA_DESPACHO').length;
  document.querySelector('#processTable').innerHTML = processes.map((item) => `<tr><td>${escapeHtml(item.number)}</td><td>${escapeHtml(item.subject)}</td><td>${escapeHtml(item.sender_name)}</td><td><span class="state">${escapeHtml(stateLabel(item.state))}</span></td><td>${escapeHtml(item.priority)}</td><td>${new Date(item.created_at).toLocaleDateString('pt-PT')}</td><td><button class="table-action" data-process-id="${item.id}">Abrir</button></td></tr>`).join('') || '<tr><td colspan="7">Não foram encontrados expedientes.</td></tr>';
}

function renderList(target, records, template, emptyText) {
  document.querySelector(target).innerHTML = records.length ? records.map(template).join('') : `<p class="muted">${emptyText}</p>`;
}

function renderDetail(process) {
  document.querySelector('#processDetail').classList.remove('hidden');
  document.querySelector('#detailTitle').textContent = `${process.number} — ${process.subject}`;
  document.querySelector('#detailSubtitle').textContent = `Remetente: ${process.sender_name} · Localização: ${process.location_note || 'Não registada'}`;
  document.querySelector('#detailState').textContent = stateLabel(process.state);
  renderList('#documentsList', process.documents, (item) => `<div class="record"><strong>${escapeHtml(item.original_name)}</strong><small>${escapeHtml(item.document_type)} · v${item.version} · ${escapeHtml(item.validation_state)}</small>${item.rejection_reason ? `<p>Motivo: ${escapeHtml(item.rejection_reason)}</p>` : ''}${item.validation_state === 'PENDENTE' && hasPermission('document.validate') ? `<button data-validate-document="${item.id}" data-state="VALIDADO">Validar</button><button class="secondary" data-validate-document="${item.id}" data-state="REJEITADO">Rejeitar</button>` : ''}</div>`, 'Sem documentos carregados.');
  renderList('#routesList', process.routes, (item) => `<div class="record"><strong>${escapeHtml(item.origin_department || 'Origem inicial')} → ${escapeHtml(item.destination_department || 'Sem destino')}</strong><small>Enviado por ${escapeHtml(item.sent_by_name)} em ${formatDate(item.sent_at)}</small><p>${escapeHtml(item.note || 'Sem observação.')}</p>${!item.received_at && hasPermission('process.receive') ? `<button data-receive-route="${item.id}">Confirmar recebimento</button>` : `<small>${item.received_at ? `Recebido por ${escapeHtml(item.received_by_name)} em ${formatDate(item.received_at)}` : 'Aguardando confirmação'}</small>`}</div>`, 'Sem encaminhamentos registados.');
  renderList('#opinionsList', process.opinions, (item) => `<div class="record"><strong>Versão ${item.version}</strong><small>${escapeHtml(item.author_name)} · ${formatDate(item.created_at)}</small><p>${escapeHtml(item.content)}</p></div>`, 'Sem pareceres emitidos.');
  renderList('#dispatchesList', process.dispatches, (item) => `<div class="record"><strong>${escapeHtml(item.decision)}</strong><small>${escapeHtml(item.decided_by_name)} · ${formatDate(item.issued_at)}</small><p>${escapeHtml(item.reasoning || 'Sem fundamentação adicional.')}</p></div>`, 'Sem despachos emitidos.');
  renderList('#loansList', process.loans, (item) => `<div class="record"><strong>${escapeHtml(item.requester_name)}</strong><small>Saída: ${formatDate(item.loaned_at)} · Prazo: ${formatDate(item.due_at)}</small><p>${escapeHtml(item.reason)}</p>${item.returned_at ? `<small>Devolvido em ${formatDate(item.returned_at)}</small>` : hasPermission('archive.manage') ? `<button data-return-loan="${item.id}">Registar devolução</button>` : '<small>Empréstimo activo</small>'}</div>`, 'Sem empréstimos registados.');
  document.querySelector('#documentForm').classList.toggle('hidden', !hasPermission('document.upload'));
  document.querySelector('#routeForm').classList.toggle('hidden', !hasPermission('process.route'));
  document.querySelector('#opinionForm').classList.toggle('hidden', !hasPermission('opinion.create'));
  document.querySelector('#dispatchForm').classList.toggle('hidden', !hasPermission('dispatch.create'));
  document.querySelector('#completeForm').classList.toggle('hidden', !hasPermission('process.complete') || process.state !== 'DESPACHADO');
  document.querySelector('#archiveForm').classList.toggle('hidden', !hasPermission('archive.manage') || process.state !== 'CONCLUIDO');
  document.querySelector('#loanForm').classList.toggle('hidden', !hasPermission('archive.manage') || process.state !== 'ARQUIVADO');
}

async function openProcess(id) { selectedProcessId = id; renderDetail(await api(`/processes/${id}`)); document.querySelector('#processDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function refreshSelectedProcess() { if (selectedProcessId) await openProcess(selectedProcessId); await loadProcesses(); }
function selectedIds(containerId) { return [...document.querySelectorAll(`#${containerId} input:checked`)].map((input) => Number(input.value)); }

async function loadAdmin() {
  if (!hasPermission('user.manage') || !hasPermission('role.manage')) return;
  document.querySelector('#adminNav').classList.remove('hidden'); document.querySelector('#adminPanel').classList.remove('hidden');
  const [users, roles, permissions] = await Promise.all([api('/admin/users'), api('/admin/roles'), api('/admin/permissions')]);
  adminRoles = roles;
  adminPermissions = permissions;
  document.querySelector('#userRoles').innerHTML = roles.map((role) => `<label><input type="checkbox" value="${role.id}">${escapeHtml(role.name)} <small>(${escapeHtml(role.code)})</small></label>`).join('');
  document.querySelector('#rolePermissions').innerHTML = permissions.map((permission) => `<label><input type="checkbox" value="${permission.id}"><span>${escapeHtml(permission.code)}<small>${escapeHtml(permission.description)}</small></span></label>`).join('');
  renderList('#adminUsers', users, (user) => `<div class="record"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.username)} · ${escapeHtml(user.email)} · ${user.active ? 'ACTIVO' : 'INACTIVO'}</small><p>${escapeHtml(user.roles || 'Sem perfil')}</p><button data-user-edit="${user.id}">Editar permissões</button><button data-user-toggle="${user.id}" data-active="${user.active ? 'false' : 'true'}">${user.active ? 'Desactivar' : 'Activar'}</button></div>`, 'Ainda não existem funcionários.');
  renderList('#adminRoles', roles, (role) => `<div class="record"><strong>${escapeHtml(role.name)}</strong><small>${escapeHtml(role.code)}</small><p>${escapeHtml(role.permissions || 'Sem permissões')}</p></div>`, 'Ainda não existem perfis.');
}

async function loadReports() {
  if (!hasPermission('report.read')) return;
  document.querySelector('#reportNav').classList.remove('hidden'); document.querySelector('#reportPanel').classList.remove('hidden');
  const report = await api('/reports/overview');
  renderList('#statesReport', report.byState, (item) => `<div class="record"><strong>${escapeHtml(stateLabel(item.state))}</strong><small>${item.total} processo(s)</small></div>`, 'Sem dados.');
  renderList('#departmentsReport', report.byDepartment, (item) => `<div class="record"><strong>${escapeHtml(item.name)}</strong><small>${item.total} processo(s)</small></div>`, 'Sem dados.');
  renderList('#overdueLoansReport', report.overdueLoans, (item) => `<div class="record"><strong>${escapeHtml(item.number)}</strong><small>${escapeHtml(item.requester_name)} · prazo: ${formatDate(item.due_at)}</small><p>${escapeHtml(item.subject)}</p></div>`, 'Não existem empréstimos em atraso.');
}

async function loadAudit() {
  if (!hasPermission('audit.read')) return;
  document.querySelector('#auditNav').classList.remove('hidden'); document.querySelector('#auditPanel').classList.remove('hidden');
  document.querySelector('#deleteAccessHistoryButton').classList.toggle('hidden', !hasPermission('audit.manage'));
  const items = await api('/audit-logs');
  renderList('#auditList', items, (item) => `<div class="record"><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.actor_name || 'Sistema')} · ${formatDate(item.created_at)} · ${escapeHtml(item.entity)} #${escapeHtml(item.entity_id)}</small></div>`, 'Sem eventos de auditoria.');
}

async function initialiseApp() {
  const roles = currentUser.roles?.map((role) => role.name).join(', ') || 'Sem perfil';
  document.querySelector('#userName').textContent = `${currentUser.name || 'Utilizador'} · ${roles}`; showApp();
  await Promise.all([loadSenders(), loadDepartments(), loadProcesses(), loadArchiveUsers(), loadAdmin(), loadReports(), loadAudit()]);
  if (!currentUser.permissions?.length) showMessage('A sua conta não possui nenhum perfil com permissões. Solicite ao administrador a atribuição de um perfil.');
}

document.querySelector('#loginForm').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); localStorage.setItem('sgepa_token', data.token); localStorage.setItem('sgepa_user', JSON.stringify(data.user)); currentUser = data.user; await initialiseApp(); showMessage('Sessão iniciada com sucesso.'); } catch (error) { showMessage(error.message, document.querySelector('#loginMessage'), 'error'); } });
document.querySelector('#senderForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api('/senders', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await loadSenders(); showMessage('Remetente guardado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#processForm').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await api('/processes', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await loadProcesses(); showMessage(`Expediente ${data.number} registado com sucesso.`); } catch (error) { showMessage(error.message); } });
document.querySelector('#searchForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await loadProcesses(Object.fromEntries(new FormData(event.currentTarget))); showMessage('Pesquisa concluída com sucesso.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#clearSearchButton').addEventListener('click', async () => { document.querySelector('#searchForm').reset(); try { await loadProcesses({}); showMessage('Filtros de pesquisa removidos.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#documentForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/documents`, { method: 'POST', body: new FormData(event.currentTarget) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Documento carregado. Aguarda validação.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#routeForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const dueAt = document.querySelector('#dueAt').value; if (dueAt) data.dueAt = `${dueAt}T23:59:59`; try { await api(`/processes/${selectedProcessId}/routes`, { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Processo encaminhado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#opinionForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/opinions`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Parecer registado e encaminhado para despacho.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#dispatchForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/dispatches`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Despacho registado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#completeForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/complete`, { method: 'POST', body: '{}' }); await refreshSelectedProcess(); showMessage('Processo concluído com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#archiveForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/archive`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Processo arquivado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#loanForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await api(`/processes/${selectedProcessId}/loans`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); await refreshSelectedProcess(); showMessage('Empréstimo registado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#processTable').addEventListener('click', async (event) => { const id = event.target.dataset.processId; if (!id) return; try { await openProcess(id); showMessage('Expediente aberto com sucesso.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#documentsList').addEventListener('click', async (event) => { const id = event.target.dataset.validateDocument; if (!id) return; const state = event.target.dataset.state; const rejectionReason = state === 'REJEITADO' ? window.prompt('Indique o motivo da rejeição:') : null; if (state === 'REJEITADO' && !rejectionReason) return; try { await api(`/processes/documents/${id}/validation`, { method: 'PATCH', body: JSON.stringify({ validationState: state, rejectionReason }) }); await refreshSelectedProcess(); showMessage(`Documento ${state.toLowerCase()}.`); } catch (error) { showMessage(error.message); } });
document.querySelector('#routesList').addEventListener('click', async (event) => { const id = event.target.dataset.receiveRoute; if (!id) return; try { await api(`/processes/routes/${id}/receive`, { method: 'PATCH', body: '{}' }); await refreshSelectedProcess(); showMessage('Recebimento confirmado. O processo está em análise.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#loansList').addEventListener('click', async (event) => { const id = event.target.dataset.returnLoan; if (!id) return; try { await api(`/processes/loans/${id}/return`, { method: 'PATCH', body: '{}' }); await refreshSelectedProcess(); showMessage('Devolução registada com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#userAdminForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.roleIds = selectedIds('userRoles'); try { await api('/admin/users', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); await loadAdmin(); await loadArchiveUsers(); showMessage('Funcionário criado e pronto para aceder ao sistema.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#roleForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.code = data.code.trim().toUpperCase(); data.permissionIds = selectedIds('rolePermissions'); if (!data.permissionIds.length) return showMessage('Seleccione pelo menos uma permissão para o perfil.'); try { await api('/admin/roles', { method: 'POST', body: JSON.stringify(data) }); event.currentTarget.reset(); await loadAdmin(); showMessage('Perfil criado com sucesso.'); } catch (error) { showMessage(error.message); } });
document.querySelector('#adminUsers').addEventListener('click', async (event) => {
  const editUserId = event.target.dataset.userEdit;
  const userId = event.target.dataset.userToggle;
  try {
    if (editUserId) {
      const access = await api(`/admin/users/${editUserId}/access`);
      document.querySelector('#accessUserId').value = access.id;
      document.querySelector('#accessUserName').textContent = access.name;
      document.querySelector('#accessUserRoles').innerHTML = adminRoles.map((role) => `<label><input type="checkbox" value="${role.id}" ${access.roleIds.includes(role.id) ? 'checked' : ''}>${escapeHtml(role.name)}</label>`).join('');
      document.querySelector('#accessUserPermissions').innerHTML = adminPermissions.map((permission) => `<label><input type="checkbox" value="${permission.id}" ${access.permissionIds.includes(permission.id) ? 'checked' : ''}><span>${escapeHtml(permission.code)}<small>${escapeHtml(permission.description)}</small></span></label>`).join('');
      document.querySelector('#userPermissionsForm').classList.remove('hidden');
      document.querySelector('#userPermissionsForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!userId) return;
    await api(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ active: event.target.dataset.active === 'true' }) }); await loadAdmin(); showMessage('Estado do funcionário actualizado.');
  } catch (error) { showMessage(error.message, appMessage, 'error'); }
});
document.querySelector('#userPermissionsForm').addEventListener('submit', async (event) => { event.preventDefault(); const userId = document.querySelector('#accessUserId').value; try { await api(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ roleIds: selectedIds('accessUserRoles'), permissionIds: selectedIds('accessUserPermissions') }) }); document.querySelector('#userPermissionsForm').classList.add('hidden'); await loadAdmin(); showMessage('Permissões do utilizador actualizadas com sucesso.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#cancelUserPermissionsButton').addEventListener('click', () => document.querySelector('#userPermissionsForm').classList.add('hidden'));
document.querySelector('#refreshButton').addEventListener('click', async () => { try { await loadProcesses(); showMessage('Lista de expedientes actualizada.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#refreshReportsButton').addEventListener('click', async () => { try { await loadReports(); showMessage('Relatórios actualizados.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#refreshAuditButton').addEventListener('click', async () => { try { await loadAudit(); showMessage('Histórico actualizado.'); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#deleteAccessHistoryButton').addEventListener('click', async () => { if (!window.confirm('Eliminar todos os registos de início de sessão? Esta acção não pode ser desfeita.')) return; try { const result = await api('/audit-logs/access-history', { method: 'DELETE' }); await loadAudit(); showMessage(`${result.deleted} registo(s) de acesso eliminado(s) com sucesso.`); } catch (error) { showMessage(error.message, appMessage, 'error'); } });
document.querySelector('#logoutButton').addEventListener('click', () => { localStorage.removeItem('sgepa_token'); localStorage.removeItem('sgepa_user'); currentUser = null; selectedProcessId = null; activeFilters = {}; showLogin(); showMessage('Sessão terminada com sucesso.', document.querySelector('#loginMessage')); });

if (getToken()) { currentUser = JSON.parse(localStorage.getItem('sgepa_user') || '{}'); initialiseApp().catch(() => { localStorage.clear(); showLogin(); }); }
