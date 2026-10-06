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
- visões semana e mês filtram somente as concluídas pela data de conclusão; todas as tarefas abertas permanecem visíveis, com prazo vencido, futuro ou sem prazo;
- Kanban com cartões, progresso do checklist, responsáveis e prazo;
- análise por usuário dentro de cada equipe, com indicadores por período, distribuição por status, ritmo detalhado de conclusões e radares de pendências e entregas;
- análise da equipe com cards expansíveis por membro, entregas, prévias de anexos e localização; a lista Por usuário mostra apenas quem concluiu pelo menos uma tarefa no período;
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

Requisitos: Node.js 22 e PostgreSQL 16+. Se houver Docker, o banco de desenvolvimento pode ser iniciado com:

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
GESTAO_VENDAS_SUPABASE_URL=https://ewkexlyywmvufbirmpot.supabase.co
GESTAO_VENDAS_SUPABASE_PUBLISHABLE_KEY=<chave-publishable-do-projeto>
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

- As rotas web verificam sessão e participação na equipe (administradores acessam todas). Supervisor e Coordenador também precisam estar atribuídos à atividade.
- Cada requisição autenticada web verifica no banco se a conta existe, está ativa e conserva perfil, login e versão da sessão. Alterar perfil, ativação ou login incrementa `sessionVersion`, invalidando tokens anteriores inclusive após reativação. A interface verifica a sessão ao recuperar o foco e a cada 30 segundos; a API bloqueia na próxima requisição.
- Downloads de anexos também passam pela autorização; o diretório não é servido publicamente.
- Nomes físicos dos arquivos são UUIDs e o limite por upload é 10 MB.
- Exclusões de tarefa são lógicas e registradas na timeline.
- A aba Conversa está ativa e exibe também as observações enviadas pelo aplicativo.
- Excluir uma pasta preserva suas tarefas na raiz da equipe; excluir uma equipe remove definitivamente todo o conteúdo pertencente a ela.
- Credenciais e arquivos enviados ficam fora do Git.

## Integração móvel com o Gestão de Vendas

As rotas em `/api/mobile/agenda` validam a sessão Supabase e o perfil ativo do Gestão de Vendas a cada requisição.

- Supervisor/Coordenador: vínculo por código e perfil com uma única conta ativa na Agenda; consulta, criação e edição das próprias atribuições, avanço de status, observações e fotos. Não podem excluir ou reatribuir tarefas. Coordenadores consultam somente a própria agenda.
- Diretoria/Outros: consulta de agendas comerciais, sem edição.
- Gerência: consulta limitada aos responsáveis retornados por `get_agenda_visible_owners` no Supabase.
- Criação regional: equipe `Comercial Externo` e pastas `Capital` (coordenador 12), `Cariri` (13) e `Interior` (10). No aplicativo, o supervisor usa o código de seu coordenador. No web, a região é resolvida pelo cadastro sincronizado, código ou atribuições anteriores.
- O aplicativo pode registrar localização opcional na conclusão. As respostas móveis e o web de Supervisor/Coordenador omitem as coordenadas. Administrador/Colaborador podem consultá-las no web, respeitando o acesso à tarefa.
- O filtro móvel permanece por prazo, incluindo tarefas sem prazo. A nova regra por data de conclusão aplica-se às visualizações web.

## Períodos e indicadores no web

Lista, Kanban e análise individual incluem todas as tarefas abertas e somente as concluídas com `completedAt` dentro do intervalo selecionado (início inclusivo, fim exclusivo). Tarefas concluídas sem prazo também seguem a data de conclusão. Uma tarefa com prazo em setembro e concluída em outubro aparece nas entregas de outubro.

A taxa de conclusão é `concluídas no período / (todas as abertas + concluídas no período)`. Ela descreve a carteira atual, não uma fotografia histórica das atribuições. A análise da equipe conta tarefas distintas no total; tarefas compartilhadas aparecem no card de cada responsável. Responsáveis de entregas que já não integram a equipe continuam representados; tarefas sem responsável têm um grupo próprio.

Criar diretamente como Concluída registra `completedAt`. Reabrir limpa essa data e a localização; concluir novamente registra uma nova conclusão. Registros antigos sem `completedAt` não recebem data presumida nem entram nos indicadores de entregas.

## Imagens e anexos

Na janela da atividade, Ctrl+V, a área de colagem e o botão Colar print aceitam imagens do clipboard. Antes de criar a atividade, os arquivos ficam pendentes e são enviados ao salvar. Uploads que falharem permanecem disponíveis para nova tentativa. O limite é 10 MB por arquivo.

Imagens têm prévia e abrem em outra aba ao clicar; o botão direito permite salvar. Demais arquivos continuam com download. Lista e Kanban sinalizam anexos com clipe e localização compartilhada com mapa. O navegador precisa permitir leitura do clipboard para o botão Colar print; o evento nativo Ctrl+V usa os dados fornecidos pelo próprio navegador.

## Validação e atualização

`npm test` executa testes unitários e de rotas com banco simulado. `npm run build` gera o Prisma Client, compila o backend e o frontend. `npm run test:e2e --workspace frontend` executa testes de navegador com Chrome instalado, API simulada e servidor isolado na porta 5178, incluindo clipboard real. Não usa o banco de produção.

Esta versão adiciona `User.sessionVersion` com valor inicial zero. O comando de inicialização existente (`prisma db push --skip-generate`) aplica a coluna no deploy; tokens anteriores são tratados como versão zero e continuam válidos somente enquanto a conta e o perfil coincidirem. Não é necessário adicionar variáveis de ambiente.
