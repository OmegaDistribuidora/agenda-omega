# Agenda Omega

Agenda colaborativa interna da Omega. Reúne atividades pessoais e das equipes em lista e Kanban, com responsáveis, prazos, prioridades, pastas, tags, subtarefas, comentários, anexos e histórico.

## O que está pronto

- login delegado pelo SSO do Ecossistema Omega e login local de desenvolvimento;
- usuários em uma ou várias equipes, com código opcional e perfis de Colaborador, Supervisor, Coordenador ou Administrador;
- criação rápida pela última linha da lista e criação completa pelo modal;
- vários responsáveis por atividade;
- estados **A fazer**, **Em andamento** e **Concluído**, inclusive por botão rápido ou drag-and-drop;
- prioridades **Baixa**, **Média**, **Alta** e **Urgente**;
- lista pessoal, listas por equipe, pastas compartilhadas dentro de cada equipe e busca;
- visões semana e mês;
- Kanban com cartões, progresso do checklist, responsáveis e prazo;
- análise por usuário dentro de cada equipe, com indicadores por período, distribuição por status, ritmo de conclusões e radar de pendências;
- descrição, subtarefas, timeline e anexos de até 10 MB;
- exclusão lógica, preservando o evento no histórico do banco;
- administração para criar, editar e excluir equipes e usuários;
- layout responsivo para desktop, tablet e celular.

## Stack

- Frontend: React 18, Vite e Lucide
- Backend: Fastify 5 e TypeScript
- Persistência: PostgreSQL e Prisma
- Deploy: Railway com build único; o backend serve o frontend compilado

## Executar localmente

Requisitos: Node.js 20+ e PostgreSQL 16+. Se houver Docker, o banco de desenvolvimento pode ser iniciado com:

```bash
docker compose up -d postgres
```

Depois:

```bash
copy .env.example .env
npm install
npm run prisma:push
npm run dev
```

No PowerShell, `Copy-Item .env.example .env` é equivalente ao comando `copy`.

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Saúde: http://localhost:3000/api/health

Em desenvolvimento são criados a equipe **Operações**, alguns usuários e atividades demonstrativas. O acesso inicial usa as variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD` do `.env`. Os dados demonstrativos nunca são criados em `NODE_ENV=production`.

## Contrato do SSO

O contrato é o mesmo utilizado nos sistemas `powerbi` e `sistema-pagamentos`:

1. O Ecossistema abre a Agenda em `https://agenda.exemplo/#sso=<jwt-curto>`.
2. O frontend envia esse JWT uma única vez para `POST /api/auth/sso/exchange`.
3. O backend valida HS256, issuer, audience, expiração e uso único do `jti`.
4. O `targetLogin` precisa corresponder ao `username` de um usuário ativo cadastrado na Agenda.
5. A Agenda emite sua própria sessão. O fragmento é removido imediatamente da URL.

Claims esperados:

```json
{
  "iss": "ecosistema-omega",
  "aud": "agenda-omega",
  "jti": "identificador-unico",
  "exp": 1787000000,
  "targetLogin": "joao",
  "ecosystemUsername": "joao",
  "ecosystemIsAdmin": false
}
```

Contas administrativas exigem `ecosystemIsAdmin=true` e o mesmo login de destino ou presença em `ECOSYSTEM_SSO_ADMIN_USERS`. Em produção, login local administrativo é bloqueado.

## Variáveis de ambiente

Consulte [.env.example](./.env.example). Em produção são obrigatórios valores fortes para `JWT_SECRET` e `ADMIN_PASSWORD`.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão PostgreSQL |
| `JWT_SECRET` | assinatura da sessão própria da Agenda |
| `JWT_EXPIRES_IN` | validade da sessão, padrão `8h` |
| `ECOSYSTEM_SSO_SHARED_SECRET` | valida os tokens do Ecossistema |
| `ECOSYSTEM_SSO_ISSUER` | padrão `ecosistema-omega` |
| `ECOSYSTEM_SSO_AUDIENCE` | deve ser `agenda-omega` |
| `UPLOADS_DIR` | diretório persistente dos anexos |

### Variáveis no serviço Agenda Omega

Configure no Railway da Agenda:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<segredo-exclusivo-da-agenda>
JWT_EXPIRES_IN=8h
ADMIN_USERNAME=<login-inicial-da-agenda>
ADMIN_PASSWORD=<senha-forte-de-bootstrap>
ADMIN_DISPLAY_NAME=Administrador
UPLOADS_DIR=/uploads
ECOSYSTEM_SSO_ISSUER=ecosistema-omega
ECOSYSTEM_SSO_AUDIENCE=agenda-omega
ECOSYSTEM_SSO_SHARED_SECRET=<segredo-compartilhado-com-o-ecossistema>
ECOSYSTEM_SSO_ADMIN_USERS=<logins-admin-do-ecossistema-separados-por-virgula>
```

O Railway fornece `PORT` automaticamente. Monte um volume persistente em `/uploads`. `JWT_SECRET` e `ECOSYSTEM_SSO_SHARED_SECRET` devem ser valores fortes e diferentes.

### Variáveis no serviço Ecossistema Omega

Ao cadastrar o sistema no Ecossistema, use a chave SSO `agenda-omega`. Essa chave é normalizada para `AGENDA_OMEGA`, portanto o serviço do Ecossistema precisa destas variáveis:

```env
SSO_ISSUER=ecosistema-omega
SSO_TOKEN_TTL=45
SSO_SECRET_AGENDA_OMEGA=<mesmo-valor-de-ECOSYSTEM_SSO_SHARED_SECRET>
SSO_AUDIENCE_AGENDA_OMEGA=agenda-omega
```

Opcionalmente, `SSO_TTL_AGENDA_OMEGA=45` permite controlar o TTL apenas da Agenda.

No painel do Ecossistema:

1. Cadastre o sistema com a URL pública da Agenda.
2. Habilite o login delegado SSO.
3. Use `agenda-omega` como chave SSO.
4. Libere o sistema para os usuários desejados.
5. Em **Mapeamentos SSO**, associe cada usuário ao `username` exato cadastrado na Agenda.

Para contas administrativas, o usuário do Ecossistema precisa ser administrador. Se o login do Ecossistema for diferente do login alvo na Agenda, inclua-o em `ECOSYSTEM_SSO_ADMIN_USERS` no serviço da Agenda.

## Railway

1. Crie um projeto e adicione um serviço PostgreSQL.
2. Vincule o repositório da Agenda ao serviço da aplicação.
3. Configure `DATABASE_URL` usando a variável fornecida pelo PostgreSQL.
4. Configure os segredos do `.env.example` e `NODE_ENV=production`.
5. Adicione um volume persistente montado em `/uploads` e defina `UPLOADS_DIR=/uploads`.
6. Faça o deploy. O [railway.json](./railway.json) executa o build, aplica `prisma db push` no start e verifica `/api/health`.

Antes de produção, troque `prisma db push` por migrações versionadas quando o schema estiver estabilizado.

## Comandos

```bash
npm run dev              # frontend e backend
npm run build            # build de produção
npm test                 # testes unitários
npm run prisma:generate  # gera o Prisma Client
npm run prisma:push      # aplica o schema no banco configurado
npm run seed             # garante dados iniciais fora de produção
```

## Segurança e armazenamento

- Todas as rotas de tarefa verificam sessão e participação na equipe.
- Downloads de anexos também passam pela autorização; o diretório não é servido publicamente.
- Nomes físicos dos arquivos são UUIDs e o limite por upload é 10 MB.
- Exclusões de tarefa são lógicas e registradas na timeline.
- A estrutura de comentários permanece no banco e na API para uso futuro, mas está oculta na interface por uma feature flag.
- Excluir uma pasta preserva suas tarefas na raiz da equipe; excluir uma equipe remove definitivamente todo o conteúdo pertencente a ela.
- Credenciais e arquivos enviados ficam fora do Git.
