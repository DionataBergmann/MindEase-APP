# MindEase App

App mobile (Expo/React Native) do **MindEase** — mesma experiência do mindease-web: funcionalidades, cores, Firebase e API compartilhada.

## Get started

1. Instale as dependências

   ```bash
   npm install
   ```

2. Configure o ambiente

   Copie `.env.example` para `.env` e preencha com os mesmos valores do **mindease-web** (Firebase) e a URL da API:

   ```bash
   cp .env.example .env
   ```

   - **Firebase:** use as mesmas chaves do web, com prefixo `EXPO_PUBLIC_` (ex: `EXPO_PUBLIC_FIREBASE_API_KEY=...`).
   - **API:** `EXPO_PUBLIC_API_BASE_URL` = URL do mindease-web (em dev use o IP da sua máquina, ex: `http://192.168.1.10:3000`).

3. Inicie o app

   ```bash
   npx expo start
   ```

   No output você pode abrir em development build, emulador Android, simulador iOS ou Expo Go.

## Roadmap e branches

O desenvolvimento está organizado em branches e PRs. Veja [docs/APP-ROADMAP.md](docs/APP-ROADMAP.md).

## Learn more

- [Expo](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
