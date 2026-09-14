# SGEPA — Sistema de Gestão de Expedientes e Processos Administrativos

Base de análise e desenvolvimento do SGEPA como aplicação web.

## Tecnologia prevista

- Frontend: HTML5, CSS3 e JavaScript modular
- Backend: Node.js + Express
- Base de dados: MySQL 8
- Ficheiros: armazenamento local organizado por expediente (substituível por serviço de objectos)
- Segurança: sessões JWT, palavras-passe com bcrypt e controlo de acesso por perfis

## Entregáveis de análise

- [Especificação de requisitos](docs/ESPECIFICACAO_REQUISITOS_SGEPA.md)
- [Arquitectura e modelo de dados](docs/ARQUITECTURA_E_MODELO_DE_DADOS.md)

## Executar o MVP

1. Instale o MySQL 8 e crie a base de dados:

 
   ```mysql_commands line
source C:/Users/hp/Desktop/Trabalho/SGEPA/database/migration_001_completion.sql
source C:/Users/hp/Desktop/Trabalho/SGEPA/database/schema.sql
source C:/Users/hp/Desktop/Trabalho/SGEPA/database/seed.sql
source C:/Users/hp/Desktop/Trabalho/SGEPA/database/migration_002_administracao.sql
source C:/Users/hp/Desktop/Trabalho/SGEPA/database/vistas.sql

Nota: Especifique os caminhos de acordo com o diretorio.
   ```

2.  Depois abra o ficheiro na pasta server `server/.env` modifique e ajuste `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `JWT_SECRET`.

Seguindo o exemplo:
``` 
PORT=3000
CLIENT_ORIGIN=http://localhost:5500
JWT_SECRET= uma-palavra-passe-segura
JWT_EXPIRES_IN=8h
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sgepa
DB_USER=root
DB_PASSWORD=AdminM123!
UPLOAD_DIR=uploads
```

3. Instale as dependências e crie o administrador:

   ```powershell 
   cd " o caminho da pasta server " exemplo: "C:\User\Documents\My project\SGEPA\server"
   npm.cmd install
   $env:ADMIN_PASSWORD='uma palavra-passe-segura'
   npm.cmd run seed:admin
   npm.cmd run dev
   ```

4. Com o comando `npm.cmd run dev` em execução, abra [http://localhost:3000](http://localhost:3000). A API agora também disponibiliza a interface, por isso este é o modo recomendado e basta um terminal.

   Se preferir usar a porta 5500, num **segundo terminal**, ainda dentro da pasta `server`, inicie o frontend:

   ```powershell
   npm.cmd run client
   ```

   Abra então [http://localhost:5500](http://localhost:5500). Este comando é fornecido pelo próprio projecto; já não depende da extensão Live Server.
5. Entre com `admin` e a palavra-passe definida no passo 3.

## Próximas funcionalidades

O MVP permite:

- Registar remetentes e expedientes com numeração única.
- Carregar ficheiros PDF, JPG ou PNG até 15 MB e validar ou rejeitar cada documento.
- Encaminhar processos, confirmar recebimento e manter o histórico de tramitação.
- Emitir pareceres e despachos, com actualização controlada do estado do processo.
- Consultar o detalhe consolidado de documentos, tramitações, pareceres e despachos.
- Criar funcionários activos, atribuir-lhes um ou mais perfis, activar/desactivar contas e criar perfis com permissões próprias.
- Concluir processos apenas após despacho válido e sem documentos pendentes.
- Arquivar com localização física, controlar empréstimos/devoluções e destacar empréstimos atrasados.
- Pesquisar por número, assunto, remetente, estado, departamento ou período.
- Consultar relatórios operacionais e a auditoria das operações críticas.

## Validação rápida

1. Registe um remetente e um expediente.
2. Carregue e valide o documento, encaminhe-o, confirme o recebimento, emita parecer e despacho.
3. Com a permissão `process.complete`, conclua o processo; com `archive.manage`, registe a localização de arquivo.
4. Registe um empréstimo e devolução; confirme os eventos em **Auditoria** e os indicadores em **Relatórios**.
# Actualização de administração

Depois de instalar a versão actual, execute `database/migration_002_administracao.sql` na base de dados existente. Em seguida, execute `database/vistas.sql` para disponibilizar as vistas de consulta (`utilizadores`, `expedientes`, `documentos`, `historicos_auditoria`, entre outras).

O administrador pode abrir **Administração → Editar permissões** para alterar os perfis e as permissões especiais de cada utilizador. Em **Auditoria**, pode eliminar os registos de início de sessão; a eliminação fica registada na própria auditoria.
