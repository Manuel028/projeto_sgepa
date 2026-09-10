USE sgepa;

-- Permissões atribuídas directamente a utilizadores, além das permissões recebidas pelos perfis.
CREATE TABLE IF NOT EXISTS permissoes_utilizador (
  user_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_permissoes_utilizador_usuario FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_permissoes_utilizador_permissao FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

INSERT IGNORE INTO permissions (code, description) VALUES
  ('audit.manage', 'Eliminar históricos de acesso e auditoria');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'audit.manage'
WHERE r.code = 'ADMIN';
