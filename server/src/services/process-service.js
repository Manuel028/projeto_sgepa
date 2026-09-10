import { inTransaction, pool } from '../database.js';
import { writeAudit } from './audit-service.js';

export async function listProcesses(filters) {
  const conditions = [];
  const values = [];
  if (filters.number) { conditions.push('p.number LIKE ?'); values.push(`%${filters.number}%`); }
  if (filters.subject) { conditions.push('p.subject LIKE ?'); values.push(`%${filters.subject}%`); }
  if (filters.sender) { conditions.push('s.name LIKE ?'); values.push(`%${filters.sender}%`); }
  if (filters.state) { conditions.push('p.state = ?'); values.push(filters.state); }
  if (filters.departmentId && Number.isInteger(Number(filters.departmentId))) { conditions.push('p.current_department_id = ?'); values.push(Number(filters.departmentId)); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom || '')) { conditions.push('p.created_at >= ?'); values.push(`${filters.dateFrom} 00:00:00`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo || '')) { conditions.push('p.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(filters.dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT p.id, p.number, p.subject, p.state, p.priority, p.created_at,
            s.name AS sender_name, d.name AS current_department
     FROM processes p
     JOIN senders s ON s.id = p.sender_id
     LEFT JOIN departments d ON d.id = p.current_department_id
     ${where} ORDER BY p.created_at DESC LIMIT 100`,
    values
  );
  return rows;
}

export async function createProcess(data, user, ipAddress) {
  return inTransaction(async (connection) => {
    const year = new Date().getFullYear();
    await connection.execute('INSERT IGNORE INTO process_counters (year, last_sequence) VALUES (?, 0)', [year]);
    const [counterRows] = await connection.execute('SELECT last_sequence FROM process_counters WHERE year = ? FOR UPDATE', [year]);
    const sequence = counterRows[0].last_sequence + 1;
    await connection.execute('UPDATE process_counters SET last_sequence = ? WHERE year = ?', [sequence, year]);
    const number = `EXP-${year}-${String(sequence).padStart(6, '0')}`;

    const [result] = await connection.execute(
      `INSERT INTO processes (number, subject, description, priority, state, sender_id, current_department_id, created_by)
       VALUES (?, ?, ?, ?, 'REGISTADO', ?, ?, ?)`,
      [number, data.subject, data.description || null, data.priority || 'NORMAL', data.senderId, data.departmentId || null, user.id]
    );
    await connection.execute(
      `INSERT INTO physical_records (process_id, state, location_note) VALUES (?, 'NA_SECRETARIA', ?)`,
      [result.insertId, data.locationNote || null]
    );
    await writeAudit(connection, {
      actorId: user.id, action: 'PROCESS_CREATED', entity: 'process', entityId: result.insertId,
      after: { number, subject: data.subject, state: 'REGISTADO' }, ipAddress
    });
    return { id: result.insertId, number, state: 'REGISTADO' };
  });
}

export async function getProcessDetails(id) {
  const [processRows] = await pool.execute(
    `SELECT p.*, s.name AS sender_name, s.contact AS sender_contact, d.name AS current_department,
            pr.state AS physical_state, pr.location_note
     FROM processes p
     JOIN senders s ON s.id = p.sender_id
     LEFT JOIN departments d ON d.id = p.current_department_id
     LEFT JOIN physical_records pr ON pr.process_id = p.id
     WHERE p.id = ?`,
    [id]
  );
  if (!processRows.length) {
    const error = new Error('Expediente não encontrado.');
    error.status = 404;
    throw error;
  }
  const [documents, routes, opinions, dispatches, loans] = await Promise.all([
    pool.execute(`SELECT d.id, d.original_name, d.document_type, d.page_count, d.validation_state, d.rejection_reason, d.version, d.created_at, u.name AS uploaded_by_name FROM documents d JOIN users u ON u.id = d.uploaded_by WHERE d.process_id = ? ORDER BY d.created_at DESC`, [id]),
    pool.execute(`SELECT r.id, od.name AS origin_department, dd.name AS destination_department, su.name AS sent_by_name, ru.name AS received_by_name, r.note, r.due_at, r.sent_at, r.received_at FROM routing_events r LEFT JOIN departments od ON od.id = r.origin_department_id LEFT JOIN departments dd ON dd.id = r.destination_department_id JOIN users su ON su.id = r.sent_by LEFT JOIN users ru ON ru.id = r.received_by WHERE r.process_id = ? ORDER BY r.sent_at DESC`, [id]),
    pool.execute(`SELECT o.id, o.content, o.version, o.created_at, u.name AS author_name FROM opinions o JOIN users u ON u.id = o.author_id WHERE o.process_id = ? ORDER BY o.created_at DESC`, [id]),
    pool.execute(`SELECT d.id, d.decision, d.reasoning, d.issued_at, u.name AS decided_by_name FROM dispatches d JOIN users u ON u.id = d.decided_by WHERE d.process_id = ? ORDER BY d.issued_at DESC`, [id]),
    pool.execute(`SELECT l.id, l.reason, l.loaned_at, l.due_at, l.returned_at, requester.name AS requester_name, officer.name AS archive_officer_name
                  FROM archive_loans l JOIN users requester ON requester.id = l.requester_id JOIN users officer ON officer.id = l.archive_officer_id
                  WHERE l.process_id = ? ORDER BY l.loaned_at DESC`, [id])
  ]);
  return { ...processRows[0], documents: documents[0], routes: routes[0], opinions: opinions[0], dispatches: dispatches[0], loans: loans[0] };
}

export async function addDocument(processId, file, data, user, ipAddress) {
  return inTransaction(async (connection) => {
    const [processRows] = await connection.execute('SELECT id, number, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!processRows.length) {
      const error = new Error('Expediente não encontrado.');
      error.status = 404;
      throw error;
    }
    const [versionRows] = await connection.execute('SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM documents WHERE process_id = ? AND document_type = ?', [processId, data.documentType || 'OUTRO']);
    const [result] = await connection.execute(
      `INSERT INTO documents (process_id, original_name, stored_name, mime_type, document_type, page_count, version, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [processId, file.originalname, file.filename, file.mimetype, data.documentType || 'OUTRO', data.pageCount || null, versionRows[0].next_version, user.id]
    );
    if (processRows[0].state === 'REGISTADO') {
      await connection.execute("UPDATE processes SET state = 'AGUARDA_DIGITALIZACAO' WHERE id = ?", [processId]);
    }
    await writeAudit(connection, { actorId: user.id, action: 'DOCUMENT_UPLOADED', entity: 'document', entityId: result.insertId, after: { processId: Number(processId), originalName: file.originalname }, ipAddress });
    return { id: result.insertId, validationState: 'PENDENTE' };
  });
}

export async function validateDocument(id, validationState, rejectionReason, user, ipAddress) {
  if (!['VALIDADO', 'REJEITADO'].includes(validationState)) {
    const error = new Error('Seleccione VALIDADO ou REJEITADO.');
    error.status = 422;
    throw error;
  }
  if (validationState === 'REJEITADO' && !rejectionReason?.trim()) {
    const error = new Error('Indique o motivo da rejeição.');
    error.status = 422;
    throw error;
  }
  return inTransaction(async (connection) => {
    const [documentRows] = await connection.execute('SELECT id, process_id, validation_state FROM documents WHERE id = ? FOR UPDATE', [id]);
    if (!documentRows.length) {
      const error = new Error('Documento não encontrado.');
      error.status = 404;
      throw error;
    }
    const document = documentRows[0];
    if (document.validation_state !== 'PENDENTE') {
      const error = new Error('Este documento já foi validado ou rejeitado. Carregue uma nova versão para o rever.');
      error.status = 409;
      throw error;
    }
    await connection.execute('UPDATE documents SET validation_state = ?, rejection_reason = ? WHERE id = ?', [validationState, validationState === 'REJEITADO' ? rejectionReason.trim() : null, id]);
    const [pendingRows] = await connection.execute("SELECT COUNT(*) AS total FROM documents WHERE process_id = ? AND validation_state = 'PENDENTE'", [document.process_id]);
    const processState = validationState === 'VALIDADO' && pendingRows[0].total === 0 ? 'DIGITALIZADO' : 'AGUARDA_DIGITALIZACAO';
    await connection.execute('UPDATE processes SET state = ? WHERE id = ?', [processState, document.process_id]);
    await writeAudit(connection, { actorId: user.id, action: 'DOCUMENT_VALIDATED', entity: 'document', entityId: id, after: { validationState, rejectionReason: validationState === 'REJEITADO' ? rejectionReason.trim() : null }, ipAddress });
    return { id: Number(id), processId: document.process_id, validationState, processState };
  });
}

export async function routeProcess(processId, data, user, ipAddress) {
  if (!data.destinationDepartmentId) {
    const error = new Error('Seleccione o departamento de destino.');
    error.status = 422;
    throw error;
  }
  return inTransaction(async (connection) => {
    const [processRows] = await connection.execute('SELECT id, current_department_id FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!processRows.length) {
      const error = new Error('Expediente não encontrado.');
      error.status = 404;
      throw error;
    }
    const process = processRows[0];
    const [result] = await connection.execute(
      `INSERT INTO routing_events (process_id, origin_department_id, destination_department_id, sent_by, note, due_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [processId, process.current_department_id, data.destinationDepartmentId, user.id, data.note || null, data.dueAt || null]
    );
    await connection.execute("UPDATE processes SET current_department_id = ?, state = 'EM_TRAMITACAO' WHERE id = ?", [data.destinationDepartmentId, processId]);
    await connection.execute("UPDATE physical_records SET state = 'EM_TRAMITE' WHERE process_id = ?", [processId]);
    await writeAudit(connection, { actorId: user.id, action: 'PROCESS_ROUTED', entity: 'routing_event', entityId: result.insertId, after: { processId: Number(processId), destinationDepartmentId: Number(data.destinationDepartmentId) }, ipAddress });
    return { id: result.insertId, processId: Number(processId), state: 'EM_TRAMITACAO' };
  });
}

export async function receiveRoute(routeId, user, ipAddress) {
  return inTransaction(async (connection) => {
    const [routeRows] = await connection.execute('SELECT id, process_id, destination_department_id, received_at FROM routing_events WHERE id = ? FOR UPDATE', [routeId]);
    if (!routeRows.length) {
      const error = new Error('Tramitação não encontrada.');
      error.status = 404;
      throw error;
    }
    const route = routeRows[0];
    if (route.received_at) {
      const error = new Error('Este encaminhamento já foi confirmado.');
      error.status = 409;
      throw error;
    }
    await connection.execute('UPDATE routing_events SET received_by = ?, received_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id, routeId]);
    await connection.execute("UPDATE processes SET current_department_id = ?, state = 'EM_ANALISE' WHERE id = ?", [route.destination_department_id, route.process_id]);
    await writeAudit(connection, { actorId: user.id, action: 'ROUTING_RECEIVED', entity: 'routing_event', entityId: routeId, after: { processId: route.process_id }, ipAddress });
    return { id: Number(routeId), processId: route.process_id, state: 'EM_ANALISE' };
  });
}

export async function createOpinion(processId, content, user, ipAddress) {
  if (!content?.trim()) {
    const error = new Error('O texto do parecer é obrigatório.');
    error.status = 422;
    throw error;
  }
  return inTransaction(async (connection) => {
    const [processRows] = await connection.execute('SELECT id, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!processRows.length) { const error = new Error('Expediente não encontrado.'); error.status = 404; throw error; }
    if (!['EM_ANALISE', 'DEVOLVIDO'].includes(processRows[0].state)) { const error = new Error('O processo deve estar em análise para receber um parecer.'); error.status = 409; throw error; }
    const [versionRows] = await connection.execute('SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM opinions WHERE process_id = ?', [processId]);
    const [result] = await connection.execute('INSERT INTO opinions (process_id, author_id, content, version) VALUES (?, ?, ?, ?)', [processId, user.id, content.trim(), versionRows[0].next_version]);
    await connection.execute("UPDATE processes SET state = 'AGUARDA_DESPACHO' WHERE id = ?", [processId]);
    await writeAudit(connection, { actorId: user.id, action: 'OPINION_CREATED', entity: 'opinion', entityId: result.insertId, after: { processId: Number(processId), version: versionRows[0].next_version }, ipAddress });
    return { id: result.insertId, state: 'AGUARDA_DESPACHO' };
  });
}

export async function createDispatch(processId, data, user, ipAddress) {
  const decisions = ['APROVADO', 'REJEITADO', 'DEVOLVIDO', 'ENCAMINHADO', 'OUTRO'];
  if (!decisions.includes(data.decision)) { const error = new Error('Decisão inválida.'); error.status = 422; throw error; }
  return inTransaction(async (connection) => {
    const [processRows] = await connection.execute('SELECT id, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!processRows.length) { const error = new Error('Expediente não encontrado.'); error.status = 404; throw error; }
    if (processRows[0].state !== 'AGUARDA_DESPACHO') { const error = new Error('O processo deve aguardar despacho para registar uma decisão.'); error.status = 409; throw error; }
    const [result] = await connection.execute('INSERT INTO dispatches (process_id, decision, reasoning, decided_by) VALUES (?, ?, ?, ?)', [processId, data.decision, data.reasoning || null, user.id]);
    const state = data.decision === 'DEVOLVIDO' ? 'DEVOLVIDO' : data.decision === 'ENCAMINHADO' ? 'EM_TRAMITACAO' : 'DESPACHADO';
    await connection.execute('UPDATE processes SET state = ? WHERE id = ?', [state, processId]);
    await writeAudit(connection, { actorId: user.id, action: 'DISPATCH_CREATED', entity: 'dispatch', entityId: result.insertId, after: { processId: Number(processId), decision: data.decision }, ipAddress });
    return { id: result.insertId, state };
  });
}

export async function completeProcess(processId, user, ipAddress) {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!rows.length) {
      const error = new Error('Expediente não encontrado.');
      error.status = 404;
      throw error;
    }
    if (rows[0].state !== 'DESPACHADO') {
      const error = new Error('Apenas processos despachados podem ser concluídos.');
      error.status = 409;
      throw error;
    }
    const [[dispatch]] = await connection.execute('SELECT id FROM dispatches WHERE process_id = ? LIMIT 1', [processId]);
    const [[pending]] = await connection.execute("SELECT COUNT(*) AS total FROM documents WHERE process_id = ? AND validation_state = 'PENDENTE'", [processId]);
    if (!dispatch || pending.total > 0) {
      const error = new Error('O processo precisa de despacho válido e não pode ter documentos pendentes.');
      error.status = 409;
      throw error;
    }
    await connection.execute("UPDATE processes SET state = 'CONCLUIDO' WHERE id = ?", [processId]);
    await writeAudit(connection, { actorId: user.id, action: 'PROCESS_COMPLETED', entity: 'process', entityId: processId, after: { previousState: rows[0].state, state: 'CONCLUIDO' }, ipAddress });
    return { id: Number(processId), state: 'CONCLUIDO' };
  });
}

export async function archiveProcess(processId, data, user, ipAddress) {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!rows.length) { const error = new Error('Expediente não encontrado.'); error.status = 404; throw error; }
    if (rows[0].state !== 'CONCLUIDO') { const error = new Error('Apenas processos concluídos podem ser arquivados.'); error.status = 409; throw error; }
    const [[dispatch]] = await connection.execute('SELECT id FROM dispatches WHERE process_id = ? LIMIT 1', [processId]);
    const [[loan]] = await connection.execute('SELECT id FROM archive_loans WHERE process_id = ? AND returned_at IS NULL LIMIT 1', [processId]);
    if (!dispatch || loan) { const error = new Error('O processo precisa de despacho e não pode ter empréstimo activo.'); error.status = 409; throw error; }
    await connection.execute(
      `UPDATE physical_records SET state = 'NO_ARQUIVO', archive_code = ?, cabinet = ?, shelf = ?, box = ?, folder = ?, location_note = ? WHERE process_id = ?`,
      [data.archiveCode || null, data.cabinet || null, data.shelf || null, data.box || null, data.folder || null, data.locationNote || null, processId]
    );
    await connection.execute("UPDATE processes SET state = 'ARQUIVADO' WHERE id = ?", [processId]);
    await writeAudit(connection, { actorId: user.id, action: 'PROCESS_ARCHIVED', entity: 'process', entityId: processId, after: { location: data }, ipAddress });
    return { id: Number(processId), state: 'ARQUIVADO' };
  });
}

export async function createLoan(processId, data, user, ipAddress) {
  const requesterId = Number(data.requesterId);
  if (!Number.isInteger(requesterId) || !data.reason?.trim() || !data.dueAt) {
    const error = new Error('Solicitante, motivo e prazo do empréstimo são obrigatórios.'); error.status = 422; throw error;
  }
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id, state FROM processes WHERE id = ? FOR UPDATE', [processId]);
    if (!rows.length) { const error = new Error('Expediente não encontrado.'); error.status = 404; throw error; }
    if (rows[0].state !== 'ARQUIVADO') { const error = new Error('Apenas processos arquivados podem ser emprestados.'); error.status = 409; throw error; }
    const [[requester]] = await connection.execute('SELECT id FROM users WHERE id = ? AND active = TRUE', [requesterId]);
    if (!requester) { const error = new Error('Solicitante inválido ou inactivo.'); error.status = 422; throw error; }
    const [[activeLoan]] = await connection.execute('SELECT id FROM archive_loans WHERE process_id = ? AND returned_at IS NULL LIMIT 1', [processId]);
    if (activeLoan) { const error = new Error('Este processo já possui um empréstimo activo.'); error.status = 409; throw error; }
    const [result] = await connection.execute('INSERT INTO archive_loans (process_id, requester_id, archive_officer_id, reason, due_at) VALUES (?, ?, ?, ?, ?)', [processId, requesterId, user.id, data.reason.trim(), data.dueAt]);
    await connection.execute("UPDATE physical_records SET state = 'EMPRESTADO' WHERE process_id = ?", [processId]);
    await connection.execute("UPDATE processes SET state = 'EMPRESTADO' WHERE id = ?", [processId]);
    await writeAudit(connection, { actorId: user.id, action: 'LOAN_CREATED', entity: 'archive_loan', entityId: result.insertId, after: { processId: Number(processId), requesterId, dueAt: data.dueAt }, ipAddress });
    return { id: result.insertId, state: 'EMPRESTADO' };
  });
}

export async function returnLoan(loanId, user, ipAddress) {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id, process_id, returned_at FROM archive_loans WHERE id = ? FOR UPDATE', [loanId]);
    if (!rows.length) { const error = new Error('Empréstimo não encontrado.'); error.status = 404; throw error; }
    const loan = rows[0];
    if (loan.returned_at) { const error = new Error('Este empréstimo já foi devolvido.'); error.status = 409; throw error; }
    await connection.execute('UPDATE archive_loans SET returned_at = CURRENT_TIMESTAMP WHERE id = ?', [loanId]);
    await connection.execute("UPDATE physical_records SET state = 'NO_ARQUIVO' WHERE process_id = ?", [loan.process_id]);
    await connection.execute("UPDATE processes SET state = 'ARQUIVADO' WHERE id = ?", [loan.process_id]);
    await writeAudit(connection, { actorId: user.id, action: 'LOAN_RETURNED', entity: 'archive_loan', entityId: loanId, after: { processId: loan.process_id }, ipAddress });
    return { id: Number(loanId), processId: loan.process_id, state: 'ARQUIVADO' };
  });
}
