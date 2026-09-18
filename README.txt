SQM — Style Quality Model V4

Reconstrução funcional mantendo a identidade visual do SQM.
Principais melhorias:
- Carrinho persistente no navegador (localStorage).
- Estrutura canônica de variantes: produto + tamanho + cor + quantidade.
- Correção do erro que usava optionLabel antes de defini-lo.
- Variante é enviada no checkout e fica disponível no pedido/ADM.
- Quantidade e variações permanecem sincronizadas no carrinho.
- Mantidas as rotas /api/products, /api/orders, /api/checkout e /api/product-images do projeto existente.

Publique a pasta/ZIP no Netlify com o backend/API correspondente já configurado.
