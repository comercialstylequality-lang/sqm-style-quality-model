# SQM Style Quality Model — Vercel + Asaas

## O que esta versão resolve

1. Remove a dependência das funções Netlify para produtos, imagens e checkout.
2. O servidor recalcula o total usando o catálogo armazenado no Redis; o navegador não define o preço final.
3. Produtos e pedidos ficam online em Redis, em vez de depender do localStorage.
4. `api/asaas-webhook.js` recebe eventos do Asaas e atualiza o status dos pedidos.
5. O login administrativo usa credenciais no servidor e cookie HttpOnly assinado; usuário/senha não ficam no HTML.

## Serviços necessários no Vercel

### 1. Redis
No projeto Vercel, abra Storage/Marketplace e instale uma integração Redis (por exemplo Upstash Redis). A Vercel informa que o antigo Vercel KV não está disponível para novos projetos e que Redis deve ser conectado pelo Marketplace.

As variáveis esperadas são:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 2. Vercel Blob
Crie um Blob Store **Public** para imagens dos produtos e conecte-o ao projeto. A variável `BLOB_READ_WRITE_TOKEN` será disponibilizada pelo Vercel.

As imagens são públicas porque precisam ser exibidas na loja. Não use esse store para dados de pedidos.

### 3. Variáveis administrativas
Configure:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ASAAS_WEBHOOK_TOKEN`

Não coloque esses valores no HTML.

### 4. Asaas
Configure:
- `ASAAS_API_KEY`

Para produção, use a chave da conta de produção. Para testes, use a chave do Sandbox e adapte o endpoint do backend para o ambiente de Sandbox.

### 5. Webhook
Depois do deploy, configure no Asaas uma URL pública:

`https://SEU-DOMINIO.vercel.app/api/asaas-webhook`

Use a mesma string definida em `ASAAS_WEBHOOK_TOKEN` como token de autenticação do webhook. Configure eventos de pagamento necessários, principalmente recebimento/confirmacão, vencimento, cancelamento e estorno.

## Deploy

1. Suba esta pasta como projeto no Vercel.
2. Instale/configure as integrações Redis e Blob.
3. Configure todas as variáveis acima em Settings > Environment Variables.
4. Faça um novo deploy. Alterações de variáveis só passam a valer em novos deployments.
5. Entre em `/` e abra o painel administrativo.

## Login
O usuário e a senha são os valores de `ADMIN_USER` e `ADMIN_PASSWORD` no Vercel. Eles não são mais armazenados no HTML nem em localStorage.

## Fluxo do pedido

Cliente -> `/api/checkout` -> servidor lê produtos do Redis -> servidor calcula preço -> cria/consulta cliente Asaas -> cria cobrança -> Pix retorna QR/Copia e Cola ou cartão retorna `invoiceUrl` -> pedido é salvo no Redis -> Asaas chama `/api/asaas-webhook` -> status do pedido é atualizado.

## Observação sobre estoque
O checkout valida estoque e preço no servidor. A baixa automática de estoque pode ser adicionada posteriormente com uma operação atômica no banco/Redis; esta versão não baixa estoque para evitar condições de corrida em atualizações concorrentes.
### 6. IA do Editor (Gemini)
Configure também no Vercel:
- `GEMINI_API_KEY`
- `GEMINI_EDITOR_MODEL` (opcional; padrão: `gemini-3.1-pro-preview`)

A chave fica somente no servidor. O painel administrativo envia o HTML atual para `/api/editor-ai`; a chave nunca é colocada no HTML público. A API Gemini usa o endpoint `generateContent`.


### Correções desta versão
- Interface visual premium e responsiva, com melhorias no catálogo, área administrativa e editor.
- Corrigido o carregamento do Editor: ele só tenta buscar a versão protegida depois da autenticação do administrador.
- Após o login, o Editor é carregado novamente do servidor.
- Corrigido o tratamento de erros da IA para exibir o erro retornado pela Gemini.
- Gemini 3.1 Pro Preview configurado por padrão, com limite de 65.536 tokens.
- A chave da Gemini permanece somente no servidor.

### Auditoria de produção — correções adicionais
- Editor: ao salvar, a versão é publicada no Redis e carregada publicamente por `/api/site-html` para todos os visitantes.
- Estoque: reserva por chave Redis com `DECRBY` atômico, rollback em falhas e liberação em pagamento expirado/cancelado/estornado.
- Checkout: `orderId` recebe trava idempotente para impedir processamento duplicado.
- Login: limite de 10 tentativas por IP a cada 15 minutos.
- Produtos: validação de tamanho, preço, estoque, IDs duplicados e URLs permitidas.
- Asaas: se a cobrança for criada e o salvamento final falhar, o backend tenta cancelar a cobrança e liberar o estoque.
