# MindEase App — Roadmap (branches e PRs)

O **mindEase-APP** é a versão mobile (Expo/React Native) do **mindease-web**. Mesmas funcionalidades, cores (design tokens), integração Firebase e mesma API.

## Convenções

- **Base:** `main`
- **Branches:** `feature/nome-curto` ou `chore/nome-curto`
- **PRs:** um PR por branch, título claro, descrição com checklist quando fizer sentido
- **Commits:** mensagens em português, claras (ex: `feat(auth): tela de login com Firebase`)

---

## Fase 1 — Fundação

### 1. `chore/setup-theme-and-config` ✅
**Objetivo:** Alinhar tema (cores MindEase), variáveis de ambiente e config Firebase.

- [ ] Cores light/dark iguais ao mindease-web (`constants/theme.ts` = design-tokens)
- [ ] `.env.example` com `EXPO_PUBLIC_*` (Firebase + `EXPO_PUBLIC_API_BASE_URL`)
- [ ] Documentar no README como rodar com `.env`

**PR:** "chore: tema MindEase, env e config Firebase para app"

---

### 2. `feature/firebase-auth`
**Objetivo:** Auth no app usando o mesmo Firebase do web (login, logout, estado).

- [ ] SDK Firebase (app) com mesma config do web
- [ ] Telas: Login, Signup (espelhando web)
- [ ] Guard de rotas: redirecionar não logado para login
- [ ] Persistência de sessão (AsyncStorage ou equivalente)

**PR:** "feat(auth): login/signup com Firebase alinhado ao web"

---

### 3. `feature/api-client`
**Objetivo:** Cliente para chamar a API do mindease-web a partir do app.

- [ ] `EXPO_PUBLIC_API_BASE_URL` → base da API (ex: URL do deploy do web)
- [ ] Funções: `processContent` (POST /api/process-content), `chat` (POST /api/chat)
- [ ] Tratamento de erro e tipos compartilhados (se possível com web)

**PR:** "feat(api): cliente para /api/process-content e /api/chat"

---

## Fase 2 — Núcleo do produto

### 4. `feature/home-projects`
**Objetivo:** Home com lista de projetos (Firestore), igual ao web.

- [ ] Listar projetos do usuário (Firestore `projects`, `userId`, `orderBy updatedAt`)
- [ ] Cards de projeto (título, emoji, progresso, tags, último acesso)
- [ ] Busca e filtro por tag
- [ ] Botão "Novo projeto", link para tela de novo projeto

**PR:** "feat(home): lista de projetos com Firestore e filtros"

---

### 5. `feature/new-project`
**Objetivo:** Criar projeto e adicionar PDFs/materiais (upload + processamento).

- [ ] Tela "Novo projeto" (nome, emoji, opcionalmente tags)
- [ ] Upload de PDF e/ou fotos → enviar para API `process-content`
- [ ] Salvar projeto + materiais no Firestore (mesma estrutura do web)
- [ ] Navegação para detalhe do projeto após criar

**PR:** "feat(project): novo projeto com upload e processamento via API"

---

### 6. `feature/project-detail`
**Objetivo:** Detalhe do projeto, materiais, editar/excluir.

- [ ] Tela projeto por `id`: dados do projeto, lista de materiais
- [ ] Adicionar PDF/material a projeto existente
- [ ] Editar título/tags do projeto, excluir projeto (com confirmação)

**PR:** "feat(project): detalhe do projeto, materiais e ações"

---

### 7. `feature/study-flow`
**Objetivo:** Estudar (flashcards, quiz, chat) por material/projeto.

- [ ] Tela estudar por projeto (lista de materiais)
- [ ] Flashcards (carrossel) e quiz por material
- [ ] Chat de estudo usando `/api/chat` com contexto do material
- [ ] Atualizar progresso e repetição espaçada no Firestore (como no web)

**PR:** "feat(study): flashcards, quiz e chat de estudo"

---

### 8. `feature/review`
**Objetivo:** Revisão (repetição espaçada) de cards.

- [ ] Tela "Revisar" com cards pendentes (lógica igual ao web)
- [ ] Marcar como revisado e atualizar `nextReviewAt` no Firestore

**PR:** "feat(review): revisão de cards com repetição espaçada"

---

## Fase 3 — Perfil e polish

### 9. `feature/profile`
**Objetivo:** Perfil e preferências (espelhando web).

- [ ] Dados do usuário e preferências (tamanho resumo, duração sessão, etc.)
- [ ] Persistência (ex: AsyncStorage ou Firestore) alinhada ao web onde fizer sentido
- [ ] Logout

**PR:** "feat(profile): perfil e preferências do usuário"

---

### 10. `chore/navigation-and-shell`
**Objetivo:** Navegação e shell consistentes com o web.

- [ ] Abas: Home, Revisar (se houver pendentes), Perfil
- [ ] App shell / header com nome "MindEase" e navegação
- [ ] Deep links / rotas alinhadas ao web (ex: `/project/[id]`)

**PR:** "chore: navegação e app shell alinhados ao web"

---

## Ordem sugerida de execução

1. **chore/setup-theme-and-config** (esta doc + tema + .env)
2. **feature/firebase-auth**
3. **feature/api-client**
4. **feature/home-projects**
5. **feature/new-project**
6. **feature/project-detail**
7. **feature/study-flow**
8. **feature/review**
9. **feature/profile**
10. **chore/navigation-and-shell** (pode ser ajustado conforme necessidade)

---

## API base URL

O app chama a API do **mindease-web** (Next.js). Em desenvolvimento:

- Web rodando localmente: use `EXPO_PUBLIC_API_BASE_URL=http://IP_DA_MAQUINA:3000` (Expo precisa do IP para o dispositivo/emulador).
- Produção: use a URL do deploy (ex: `https://mindease-web.vercel.app`).

Firebase: use as mesmas variáveis do web (`NEXT_PUBLIC_*` no web = `EXPO_PUBLIC_*` no app com os mesmos valores).
