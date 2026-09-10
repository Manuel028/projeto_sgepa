# Arquitectura e Modelo de Dados — SGEPA

## Arquitectura proposta

```
Browser (HTML/CSS/JavaScript)
            │ HTTPS / JSON
            ▼
Node.js + Express API
 ├─ autenticação e permissões
 ├─ regras de negócio e estados
 ├─ upload seguro de ficheiros
 └─ auditoria
            │
            ├────────────► MySQL 8 (dados e histórico)
            └────────────► storage/ (PDFs e imagens)
```

O frontend deve ser uma aplicação de páginas simples, organizada em módulos JavaScript. A API segue REST, devolve JSON e concentra a validação das regras de negócio; o frontend nunca decide permissões ou transições de estado.

## Entidades principais

| Tabela | Finalidade | Campos principais |
|---|---|---|
| `users` | Contas internas | id, nome, email, password_hash, activo |
| `roles`, `permissions`, `user_roles` | Acesso baseado em perfis | role_id, permission_id, user_id |
| `departments` | Áreas da instituição | id, nome, activo |
| `senders` | Remetentes | id, tipo, nome, identificacao, contacto |
| `processes` | Expedientes | id, numero, assunto, estado, prioridade, sender_id, departamento_actual_id |
| `physical_records` | Controlo do original | process_id, estado, arquivo, armario, estante, prateleira, caixa, pasta |
| `documents` | Ficheiros digitais | id, process_id, nome_original, caminho, tipo, paginas, versao, estado_validacao |
| `routing_events` | Tramitação | id, process_id, origem, destino, enviado_por, recebido_por, enviado_em, recebido_em |
| `opinions` | Pareceres técnicos | id, process_id, autor_id, texto, documento_id, versao |
| `dispatches` | Despachos/decisões | id, process_id, decisor_id, decisao, fundamentacao, emitido_em |
| `archive_loans` | Empréstimos físicos | id, process_id, solicitante_id, saida_em, prazo_em, devolvido_em |
| `audit_logs` | Auditoria imutável | id, actor_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, criado_em |

## Relações essenciais

- Um remetente possui vários expedientes; cada expediente tem um remetente principal.
- Um expediente possui uma ficha física, vários documentos, várias tramitações e zero ou mais pareceres.
- Um expediente possui no máximo um despacho final activo.
- Um expediente só pode ter um empréstimo activo de cada vez.
- Qualquer alteração oficial cria um evento em `audit_logs`.

## Endpoints iniciais

| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/auth/login` | pública |
| GET | `/api/processes` | `process.read` |
| POST | `/api/processes` | `process.create` |
| GET | `/api/processes/:id` | `process.read` |
| POST | `/api/processes/:id/documents` | `document.upload` |
| PATCH | `/api/documents/:id/validation` | `document.validate` |
| POST | `/api/processes/:id/routes` | `process.route` |
| PATCH | `/api/routes/:id/receive` | `process.receive` |
| POST | `/api/processes/:id/opinions` | `opinion.create` |
| POST | `/api/processes/:id/dispatches` | `dispatch.create` |
| POST | `/api/processes/:id/complete` | `process.complete` |
| POST | `/api/processes/:id/archive` | `archive.manage` |
| POST | `/api/processes/:id/loans` | `archive.manage` |
| PATCH | `/api/processes/loans/:loanId/return` | `archive.manage` |
| GET | `/api/audit-logs` | `audit.read` |
| GET | `/api/reports/overview` | `report.read` |

## Estrutura do repositório a criar

```
SGEPA/
├─ client/
│  ├─ index.html
│  ├─ css/
│  └─ js/
├─ server/
│  ├─ src/{routes,controllers,services,repositories,middlewares}/
│  ├─ uploads/
│  └─ package.json
├─ database/
│  ├─ schema.sql
│  └─ seed.sql
└─ docs/
```

## Ordem recomendada de implementação

1. Preparar MySQL, variáveis de ambiente e esquema inicial.
2. Criar autenticação, perfis, permissões e auditoria.
3. Criar cadastro de remetentes e expedientes com número único.
4. Adicionar documentos, validação e controlo físico.
5. Implementar tramitação e o motor de transições de estado.
6. Implementar pareceres, despachos, conclusão e arquivo.
7. Criar painel, pesquisa, relatórios e empréstimos.
