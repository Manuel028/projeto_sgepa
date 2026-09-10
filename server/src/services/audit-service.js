export async function writeAudit(connection, { actorId, action, entity, entityId, after = null, ipAddress = null }) {
  await connection.execute(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, after_data, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [actorId, action, entity, entityId, after ? JSON.stringify(after) : null, ipAddress]
  );
}

