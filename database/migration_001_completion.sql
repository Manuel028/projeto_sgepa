USE sgepa;

-- Execute once only when upgrading a database created with the initial MVP schema.
ALTER TABLE processes MODIFY state ENUM(
  'RECEBIDO', 'REGISTADO', 'AGUARDA_DIGITALIZACAO', 'DIGITALIZADO',
  'EM_TRAMITACAO', 'EM_ANALISE', 'AGUARDA_DESPACHO', 'DESPACHADO',
  'CONCLUIDO', 'ARQUIVADO', 'EMPRESTADO', 'DEVOLVIDO', 'SUSPENSO'
) NOT NULL DEFAULT 'REGISTADO';

INSERT IGNORE INTO permissions (code, description) VALUES
  ('process.complete', 'Concluir expediente'),
  ('report.read', 'Consultar relatórios');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'process.complete'
WHERE r.code = 'DIRECCAO';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'report.read'
WHERE r.code IN ('ADMIN', 'ARQUIVO');
