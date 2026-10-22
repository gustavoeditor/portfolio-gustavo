# Creative Hub · vendas, licenças e atualizações

**Estado: construído e testado para prévia. Não vender antes de mover o site para um plano que
permita uso comercial** (o Vercel Hobby não permite — ver `LOJA-LANCAMENTO.md`).

## Modelo

1. O cliente **compra o Creative Hub na Cakto** e baixa o instalador do Hub pela entrega da Cakto.
2. A Cakto avisa o site (`purchase_approved`) → o site gera uma **chave de licença** e guarda no
   **Blob privado**. Reembolso ou chargeback **revoga** a chave.
3. O cliente pega a chave em **`/licenca.html`** (e-mail da compra + código do pedido) e cola uma vez
   no Hub (Configurações → Chave de licença). A chave fica cifrada no Windows (DPAPI).
4. **Notas de versão são públicas** em `/novidades.html`. Os **instaladores não**: só saem pelo
   endpoint protegido, com licença ativa e SHA-256 conferido.
5. Ao abrir, o Hub consulta os feeds; havendo versão nova, mostra o que mudou e pergunta se o
   cliente quer **atualizar agora ou depois**. Uma licença libera Creative Tools, as atualizações do
   próprio Hub e as próximas ferramentas.

## Peças

| Arquivo | Função |
|---|---|
| `creative-hub/catalog.json` | Catálogo do Hub (produtos, feeds, detecção). |
| `updates/creative-tools/hub-manifest.json` | Feed do Creative Tools para o Hub (o `manifest.json` do Updater v1.x não muda). |
| `updates/creative-hub/manifest.json` | Feed de atualizações do próprio Hub. |
| `lib/creative-hub-licenses.js` | `POST /api/cakto/webhook` e `POST /api/creative-hub/license`. |
| `lib/creative-hub-delivery.js` | `GET /api/creative-hub/download?product=…&version=…` (licença + Range + SHA-256). |
| `scripts/upload-creative-hub-package.mjs` | Envia o `.exe` aprovado ao Blob privado, conferindo hash e tamanho do feed. |
| `novidades.html`, `licenca.html` | Páginas públicas. |

## Variáveis (definidas uma vez; Preview primeiro, Production só com aprovação)

| Variável | Uso |
|---|---|
| `CREATIVE_HUB_DELIVERY_ENABLED` | `true` liga as entregas. |
| `CREATIVE_HUB_BLOB_TOKEN` | Token do Blob **privado** `creative-tools-private-preview` (Sensitive). |
| `CAKTO_WEBHOOK_SECRET` | Secret do webhook configurado na Cakto (Sensitive). |
| `CAKTO_PRODUCT_IDS` | IDs (ou short_id) dos produtos Cakto que dão licença, separados por vírgula. |
| `CREATIVE_HUB_TEST_LICENSE_SHA256` | Opcional: hashes de chaves de teste internas. |

Versão, SHA-256, tamanho e caminho privado **não** são variáveis: vêm do feed.

## Publicar uma nova versão (Creative Tools ou Hub)

1. CI gera o instalador; você aprova o build.
2. No feed do produto, adicione a release: `version`, `date`, `changes` (vira a nota pública),
   `status: "published"`, `sha256`, `size`, `privatePath`, `downloadUrl` relativo e `installer`
   (com `silentArgs` se o build tiver modo silencioso); aponte `latest` para ela.
3. Envie o arquivo: `node scripts/upload-creative-hub-package.mjs <exe> <produto>`.
4. PR → prévia → teste no Hub → aprovação → produção. Os clientes veem a atualização ao abrir o Hub.

## Configurar a Cakto

Em Integrações → Webhooks: URL `https://<domínio>/api/cakto/webhook`, eventos `purchase_approved`,
`refund` e `chargeback`. Copie o secret para `CAKTO_WEBHOOK_SECRET`. Use **Enviar teste** na prévia
antes da produção. Na entrega do produto (área de membros/arquivo), disponibilize o instalador do
Creative Hub e o link `/licenca.html`.

## Revogar

Reembolso/chargeback revogam automaticamente. Para desligar tudo: `CREATIVE_HUB_DELIVERY_ENABLED=false`.
