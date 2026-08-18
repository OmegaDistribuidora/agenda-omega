# Changelog

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
