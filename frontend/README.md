# React frontend

The primary web UI for the wallet platform.

## Local development

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to the platform Nginx endpoint on `http://localhost:8080`.

For the integrated application use the repository root:

```bash
docker compose up --build
```

Then open `http://localhost:8080`.

The initial UI intentionally exposes no private-key/WIF/seed form. Wallet/send functionality is enabled only when equivalent Symfony APIs and the signing boundary are ready.
