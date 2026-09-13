# SQM Admin — painel separado

Este projeto é o painel administrativo separado da loja SQM. Ele usa as mesmas chaves do Redis/Vercel KV para compartilhar produtos, pedidos e o HTML publicado com a loja.

## Deploy
1. Crie um segundo projeto na Vercel apontando para esta pasta `admin`.
2. Configure as variáveis de `.env.example` no projeto do painel.
3. Use o MESMO `KV_REST_API_URL` e `KV_REST_API_TOKEN` da loja.
4. Use `ADMIN_USER`, `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` para o login do painel.
5. Configure `BLOB_READ_WRITE_TOKEN` para permitir upload de imagens.
6. Configure `GEMINI_API_KEY` e `GEMINI_EDITOR_MODEL` para o editor IA.

A loja continua sendo o projeto `store` e o painel não expõe o catálogo público.
