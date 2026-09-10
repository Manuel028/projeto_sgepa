USE sgepa;

-- Vistas com nomes padronizados para consultas, relatórios e ferramentas de base de dados.
-- As tabelas originais são preservadas para não interromper instalações já existentes.
CREATE OR REPLACE VIEW departamentos AS SELECT * FROM departments;
CREATE OR REPLACE VIEW utilizadores AS SELECT * FROM users;
CREATE OR REPLACE VIEW perfis AS SELECT * FROM roles;
CREATE OR REPLACE VIEW permissoes AS SELECT * FROM permissions;
CREATE OR REPLACE VIEW remetentes AS SELECT * FROM senders;
CREATE OR REPLACE VIEW expedientes AS SELECT * FROM processes;
CREATE OR REPLACE VIEW registos_fisicos AS SELECT * FROM physical_records;
CREATE OR REPLACE VIEW documentos AS SELECT * FROM documents;
CREATE OR REPLACE VIEW eventos_tramitacao AS SELECT * FROM routing_events;
CREATE OR REPLACE VIEW pareceres AS SELECT * FROM opinions;
CREATE OR REPLACE VIEW despachos AS SELECT * FROM dispatches;
CREATE OR REPLACE VIEW emprestimos_arquivo AS SELECT * FROM archive_loans;
CREATE OR REPLACE VIEW historicos_auditoria AS SELECT * FROM audit_logs;
