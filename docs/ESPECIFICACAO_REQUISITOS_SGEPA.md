# Especificação de Requisitos de Software — SGEPA

**Versão:** 1.1 (proposta melhorada)  
**Sistema:** Sistema de Gestão de Expedientes e Processos Administrativos  
**Objectivo:** controlar, de ponta a ponta, a recepção, tramitação e arquivo de expedientes físicos e digitais.

## 1. Visão e âmbito

O SGEPA apoia instituições que recebem documentos administrativos em papel ou formato digital. O original físico permanece sob controlo da instituição, enquanto os documentos digitais tornam a consulta e a tramitação mais rápidas e rastreáveis.

O sistema cobre o fluxo:

`Recepção → Registo → Digitalização → Validação → Tramitação → Análise → Parecer → Despacho → Conclusão → Arquivo`

Fora do âmbito da primeira versão: assinatura digital qualificada, integração com correio electrónico, OCR automático e notificações SMS. Estes itens podem integrar versões posteriores.

## 2. Perfis e responsabilidades

| Perfil | Responsabilidades principais |
|---|---|
| Administrador | Utilizadores, perfis, permissões, parâmetros e auditoria |
| Recepção/Protocolo | Remetentes, conferência e registo inicial |
| Digitalizador | Carregamento, digitalização e controlo de qualidade |
| Técnico | Análise e emissão de parecer |
| Chefe de departamento | Distribuição, acompanhamento e reencaminhamento |
| Direcção | Despacho e decisão final |
| Arquivo | Recepção, localização, empréstimo e devolução física |
| Remetente | Consulta pública limitada do estado, quando habilitada |

Uma pessoa pode ter mais de um perfil, mas cada operação deve registar o utilizador e o perfil usado.

## 3. Casos de uso prioritários

### MVP (obrigatório)

| Código | Caso de uso | Actor principal | Resultado |
|---|---|---|---|
| UC01 | Autenticar utilizador | Todos os internos | Sessão segura e permissões carregadas |
| UC02 | Registar remetente | Protocolo | Remetente criado ou actualizado |
| UC03 | Registar expediente | Protocolo | Número único gerado e estado `REGISTADO` |
| UC04 | Anexar e validar documento | Digitalizador | Documento associado e validado/rejeitado |
| UC05 | Encaminhar e confirmar recebimento | Protocolo/Chefe/Destinatário | Histórico de tramitação completo |
| UC06 | Emitir parecer e despacho | Técnico/Direcção | Decisão registada com responsável |
| UC07 | Concluir e arquivar | Arquivo | Processo fechado e localização guardada |
| UC08 | Pesquisar e consultar histórico | Utilizadores autorizados | Processo, documentos e movimentos localizados |
| UC09 | Consultar auditoria | Administrador | Operações críticas rastreáveis |

### Pós-MVP (desejável)

- Empréstimo e devolução de processo físico com alerta de atraso.
- Relatórios exportáveis em PDF/CSV.
- Painel com indicadores por departamento e prazo.
- Consulta pública por código e PIN do remetente.
- OCR, notificações e integração com e-mail.

## 4. Requisitos funcionais consolidados

### RF01 — Autenticação e autorização

O sistema deve autenticar com e-mail ou nome de utilizador e palavra-passe. Deve encerrar sessões, bloquear utilizadores inactivos e autorizar cada acção por perfil/permissão.

### RF02 — Gestão administrativa

O administrador deve criar, editar, activar e desactivar utilizadores, perfis, departamentos, tipos de expediente, tipos documentais e estados configuráveis. A desactivação não pode apagar o histórico do utilizador.

### RF03 — Remetentes

O sistema deve criar, actualizar e consultar remetentes individuais ou institucionais, com nome, tipo, identificação, contacto, endereço e instituição. Deve permitir consultar os expedientes a eles associados conforme a permissão do utilizador.

### RF04 — Registo de expediente

O protocolo deve poder conferir a entrega, criar um expediente, seleccionar tipo, assunto, remetente, destino inicial, prioridade e observação. Ao guardar, o sistema deve gerar um número imutável no formato `EXP-AAAA-NNNNNN`.

### RF05 — Gestão físico-digital

Cada expediente deve possuir uma ficha física e zero ou mais documentos digitais. A ficha física guarda localização e estado; cada documento guarda ficheiro, tipo, páginas, data, operador, versão, estado de validação e motivo de rejeição quando aplicável.

### RF06 — Digitalização e validação

O digitalizador deve carregar PDF, JPG ou PNG para um expediente existente. Um utilizador autorizado deve validar ou rejeitar o documento. Um documento rejeitado não pode ser considerado disponível e a rejeição deve exigir um motivo.

### RF07 — Tramitação

O sistema deve encaminhar o expediente entre departamentos ou utilizadores, registando origem, destino, remetente interno, data/hora, observação e prazo. O destinatário deve confirmar o recebimento. O chefe deve poder distribuir expedientes da sua área a técnicos.

### RF08 — Análise, parecer e despacho

O técnico deve consultar o processo e criar um parecer textual ou anexar um documento. A Direcção deve consultar processo, pareceres e histórico, emitir despacho e seleccionar a decisão (`APROVADO`, `REJEITADO`, `DEVOLVIDO`, `ENCAMINHADO` ou outra configurada). Despachos e pareceres não podem ser apagados; correcções devem gerar nova versão.

### RF09 — Conclusão e arquivo

O sistema deve concluir apenas processos com despacho válido e sem pendências obrigatórias. O arquivo deve confirmar a recepção física, registar a localização definitiva, preservar os documentos digitais e permitir mudança controlada de localização.

### RF10 — Empréstimo físico

O arquivo deve poder registar solicitação, empréstimo e devolução do processo físico, com solicitante, responsável, motivo, data de saída e prazo. Processos emprestados não podem ter uma segunda saída activa.

### RF11 — Pesquisa e relatórios

Utilizadores autorizados devem pesquisar por número, remetente, assunto, data, departamento, estado e combinações desses filtros. O sistema deve apresentar relatórios de entradas, pendências, concluídos, arquivados, tramitações e digitalizações por período.

### RF12 — Auditoria

O sistema deve auditar criação, edição, mudança de estado, upload/validação de documentos, tramitação, parecer, despacho, arquivo, empréstimo, login e alteração de permissões. A auditoria guarda quem, quando, onde, entidade afectada, operação e valores relevantes.

## 5. Regras de negócio

| Código | Regra |
|---|---|
| RN01 | O número do expediente é único, gerado pelo sistema e nunca reutilizado. |
| RN02 | Um expediente deve ter pelo menos um remetente e um assunto. |
| RN03 | Todo encaminhamento cria um registo imutável de tramitação. |
| RN04 | Apenas o destino actual, o respectivo chefe ou um administrador pode confirmar uma tramitação. |
| RN05 | A localização física deve ser actualizada a cada movimentação confirmada. |
| RN06 | Um ficheiro deve pertencer a um único expediente e ter versão positiva. |
| RN07 | Um documento rejeitado exige motivo e nova digitalização ou nova versão para validação. |
| RN08 | Apenas perfis autorizados podem emitir parecer, despacho, concluir ou arquivar. |
| RN09 | Um processo só pode ser arquivado se estiver `CONCLUÍDO`, tiver despacho e não possuir empréstimo activo. |
| RN10 | Registos oficiais não são eliminados fisicamente; são inactivados ou versionados. |
| RN11 | A reabertura exige permissão específica, motivo e gera uma auditoria. |
| RN12 | O prazo de empréstimo vencido gera indicação de atraso no painel. |

## 6. Estados e transições permitidas

| Estado actual | Próximos estados permitidos | Acção autorizada |
|---|---|---|
| `RECEBIDO` | `REGISTADO`, `DEVOLVIDO` | Conferência de protocolo |
| `REGISTADO` | `AGUARDA_DIGITALIZACAO` | Registo confirmado |
| `AGUARDA_DIGITALIZACAO` | `DIGITALIZADO` | Documento carregado |
| `DIGITALIZADO` | `EM_TRAMITACAO`, `AGUARDA_DIGITALIZACAO` | Validação aprovada/rejeitada |
| `EM_TRAMITACAO` | `EM_ANALISE`, `AGUARDA_DESPACHO` | Recebimento e distribuição |
| `EM_ANALISE` | `AGUARDA_DESPACHO`, `DEVOLVIDO` | Parecer finalizado |
| `AGUARDA_DESPACHO` | `DESPACHADO`, `DEVOLVIDO` | Despacho emitido |
| `DESPACHADO` | `CONCLUIDO`, `EM_TRAMITACAO` | Encerramento ou reencaminhamento |
| `CONCLUIDO` | `ARQUIVADO`, `EM_TRAMITACAO` | Arquivo ou reabertura autorizada |
| `ARQUIVADO` | `EMPRESTADO`, `EM_TRAMITACAO` | Empréstimo ou reabertura autorizada |

Estados excepcionais como `SUSPENSO`, `REJEITADO` e `EXTRAVIADO` devem guardar sempre motivo e responsável.

## 7. Requisitos não funcionais verificáveis

| Código | Requisito |
|---|---|
| RNF01 | Palavras-passe devem ser armazenadas apenas com hash bcrypt. |
| RNF02 | APIs restritas devem exigir token válido e permissões explícitas. |
| RNF03 | Upload deve aceitar apenas PDF/JPG/PNG, com tamanho máximo configurável e nome interno seguro. |
| RNF04 | Consultas por número devem responder em até 2 segundos para a carga inicial prevista. |
| RNF05 | A interface deve funcionar nas duas versões mais recentes de Chrome, Edge e Firefox. |
| RNF06 | Todas as operações críticas devem ser transaccionais no MySQL. |
| RNF07 | Base de dados e documentos devem possuir cópia de segurança diária e processo testado de recuperação. |
| RNF08 | O sistema deve usar HTTPS em produção e variáveis de ambiente para segredos. |
| RNF09 | A aplicação deve apresentar mensagens de validação claras e não expor erros internos. |
| RNF10 | O código deve separar rotas, controladores, serviços, repositórios e interface. |

## 8. Critérios de aceitação do MVP

1. Um operador de protocolo cria um remetente e regista um requerimento; o sistema gera `EXP-2026-000001` sem duplicação.
2. Um digitalizador carrega um PDF, informa páginas e o valida; o documento fica disponível no processo.
3. O expediente é encaminhado para um departamento e o técnico confirma o recebimento; ambos os eventos aparecem no histórico.
4. O técnico emite parecer e a Direcção emite despacho; apenas utilizadores com as permissões correctas conseguem fazê-lo.
5. O arquivo só arquiva o processo depois de concluído e guarda a localização física completa.
6. Uma pesquisa por número mostra metadados, documentos permitidos, estado actual e linha cronológica.
7. Toda a sequência é visível na auditoria com utilizador, data/hora e entidade afectada.

