# Changelog

## 1.4.0 — 2026-10-06

- filtra conclusões pela data de conclusão e mantém todas as atividades abertas visíveis no web;
- registra a data ao criar uma tarefa já concluída;
- adiciona análise da equipe com entregas por pessoa, anexos e localização;
- limita a seleção Por usuário a responsáveis com conclusões no período;
- corrige conflito entre ícone File e arquivo nativo do navegador que impedia colar prints;
- permite preparar anexos antes da criação e abrir imagens em outra aba;
- adiciona indicadores de anexos e localização na lista e no Kanban;
- revoga sessões após mudança de perfil, login ou ativação, com validação a cada requisição;
- atualiza documentação e inclui testes de rotas e navegador.

### Evoluções anteriores incorporadas desde 1.3.1

- integração com Gestão de Vendas por sessão Supabase, código e perfil;
- criação regional em Comercial Externo, restrições de Supervisor/Coordenador e consulta de Gerência;
- observações, fotos e localização da conclusão no aplicativo;
- prazo inicial de hoje no web e edição de tarefas no aplicativo.

## 1.3.1 — 2026-08-19

### Correções

- impede que a equipe de demonstração **Operações** seja criada em produção a cada atualização;
- permite que o administrador apareça entre os responsáveis mesmo sem ser membro formal da equipe;
- permite salvar uma atividade sem responsáveis quando o administrador remove a própria atribuição;
- preserva a atribuição automática ao criador apenas quando nenhuma escolha de responsáveis foi enviada.

## 1.3.0 — 2026-08-19

### Funcionalidades

- exibe as atividades de cada barra do gráfico de conclusões ao passar o mouse ou usar o foco do teclado;
- permite abrir a atividade diretamente pelo detalhamento da barra;
- adiciona o radar de atividades concluídas ao lado das atividades que pedem atenção;
- aumenta a legibilidade de todos os textos neutros e cinza da análise por usuário;
- mantém os tooltips contidos na tela em desktop e celular.

## 1.2.0 — 2026-08-19

### Funcionalidades

- adiciona a visualização **Por usuário** ao lado da Lista e do Kanban nas equipes;
- permite selecionar qualquer membro da equipe para analisar sua carteira;
- apresenta total, tarefas a fazer, em andamento, concluídas, atrasadas e taxa de conclusão;
- inclui gráficos de distribuição por status e ritmo de conclusões no período;
- adiciona indicadores de prazo cumprido, atividades sem prazo e prioridades altas abertas;
- mantém atividades sem prazo em todos os períodos semanal e mensal;
- oferece radar clicável das atividades que mais pedem atenção;
- adapta todo o painel para desktop, tablet e celular.

## 1.1.0 — 2026-08-18

### Funcionalidades

- adiciona código opcional ao cadastro e à edição de usuários;
- adiciona os perfis obrigatórios Supervisor e Coordenador;
- mantém Supervisor e Coordenador com as mesmas permissões do perfil Colaborador;
- exibe código e perfil na administração e o perfil do usuário na barra lateral.

## 1.0.1 — 2026-08-18

### Correções

- corrige o build no Railway removendo a segunda execução concorrente de `npm ci`;
- fixa o ambiente de build e execução em Node.js 22, compatível com as dependências atuais.

## 1.0.0 — 2026-08-18

Primeira versão de produção da Agenda Omega.

### Funcionalidades

- autenticação delegada pelo SSO do Ecossistema Omega;
- atividades pessoais e visão completa por equipe;
- usuários vinculados a múltiplas equipes e múltiplos responsáveis por tarefa;
- lista com criação rápida, alteração de status e períodos semanal/mensal;
- Kanban com drag-and-drop;
- pastas compartilhadas organizadas em árvore dentro de cada equipe;
- prazos, prioridades, tags, subtarefas e histórico de alterações;
- anexos protegidos, miniaturas de imagens, drag-and-drop e captura por clipboard;
- administração de usuários e equipes, incluindo edição e exclusão;
- interface responsiva e deploy preparado para Railway/PostgreSQL.

### Segurança

- autorização por equipe em todas as rotas de tarefas e anexos;
- proteção adicional para contas administrativas via SSO;
- downloads autenticados e armazenamento persistente fora do repositório;
- exclusão lógica de atividades com preservação do histórico.
