USE sgepa;

INSERT IGNORE INTO departments (name) VALUES ('Recepção e Registo'), ('Departamento Técnico'), ('Direcção'), ('Arquivo');

INSERT IGNORE INTO roles (code, name) VALUES
  ('ADMIN', 'Administrador'), ('PROTOCOLO', 'Recepção e Protocolo'), ('DIGITALIZADOR', 'Digitalizador'),
  ('TECNICO', 'Técnico'), ('CHEFE', 'Chefe de Departamento'), ('DIRECCAO', 'Direcção'), ('ARQUIVO', 'Arquivo');

INSERT IGNORE INTO permissions (code, description) VALUES
  ('sender.read', 'Consultar remetentes'), ('sender.create', 'Criar remetentes'),
  ('process.read', 'Consultar expedientes'), ('process.create', 'Registar expedientes'),
  ('process.change_state', 'Alterar estado do expediente'), ('document.upload', 'Adicionar documentos'),
  ('document.validate', 'Validar documentos'), ('process.route', 'Encaminhar expediente'),
  ('process.receive', 'Confirmar recebimento'), ('opinion.create', 'Emitir parecer'),
  ('dispatch.create', 'Emitir despacho'), ('process.complete', 'Concluir expediente'),
  ('archive.manage', 'Gerir arquivo e empréstimos'), ('audit.read', 'Consultar auditoria'),
  ('report.read', 'Consultar relatórios'),
  ('user.manage', 'Gerir utilizadores'), ('role.manage', 'Gerir perfis e permissões'),
  ('audit.manage', 'Eliminar históricos de acesso e auditoria');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ADMIN';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('sender.read', 'sender.create', 'process.read', 'process.create', 'process.route') WHERE r.code = 'PROTOCOLO';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('process.read', 'document.upload', 'document.validate') WHERE r.code = 'DIGITALIZADOR';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('process.read', 'opinion.create', 'process.change_state') WHERE r.code = 'TECNICO';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('process.read', 'process.route', 'process.receive', 'process.change_state') WHERE r.code = 'CHEFE';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('process.read', 'dispatch.create', 'process.complete') WHERE r.code = 'DIRECCAO';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('process.read', 'archive.manage', 'report.read') WHERE r.code = 'ARQUIVO';
