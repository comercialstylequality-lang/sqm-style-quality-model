SQM — APIs de catálogo, pedidos e checkout

Arquivos:
- api/checkout.js
- api/orders.js
- api/products.js

O checkout:
1. recebe tamanho/cor enviados pelo index.html;
2. valida preço/estoque no servidor;
3. reserva estoque usando Redis/Upstash;
4. cria cliente e cobrança no Asaas;
5. salva o pedido completo em Redis, incluindo tamanho e cor.

Variáveis de ambiente necessárias:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- ASAAS_API_KEY
- ASAAS_BASE_URL (opcional; padrão produção: https://api.asaas.com/v3)
- SQM_ADMIN_SESSION_KEY (deve ser a mesma chave/valor usada pelo endpoint de login da sua instalação atual)

IMPORTANTE:
O arquivo orders.js protege GET/PATCH/DELETE com a sessão administrativa. Como o ZIP atual enviado só continha o index.html, não foi possível copiar a implementação existente de admin-login/admin-session. Portanto, se seu projeto já possui esses endpoints, eles precisam usar o cookie sqm_admin_session e a mesma SQM_ADMIN_SESSION_KEY. Se não possui, será necessário adicionar esses endpoints também.

O index.html atual já envia size/tamanho e color/cor no checkout.
