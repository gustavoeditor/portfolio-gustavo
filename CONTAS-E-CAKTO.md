# Contas de cliente + Cakto + Creative Hub

**Estado: pronto para testar no Preview, com as vendas desligadas.** Este documento substitui os
caminhos paralelos dos PRs #61 (Stripe + contas), #65 (Cakto simples), #66 (webhook Cakto) e #92
(download licenciado pelo Hub). O Stripe deixou de ser usado na loja.

## Como funciona para o cliente

1. Na loja (`/loja.html`), **Comprar** leva ao checkout oficial da Cakto (Pix/cartão). Não precisa criar conta antes.
2. A Cakto avisa o site em `POST /api/cakto/webhook` (assinatura HMAC conferida). O pedido fica salvo no Supabase com o e-mail da compra.
3. O cliente abre **`/conta`**, digita o e-mail da compra e recebe um **link de acesso** (sem senha).
4. Na conta ele vê a compra e pode:
   - **Baixar o instalador** do Creative Tools (download em partes, com SHA-256 conferido no navegador);
   - **Gerar a chave do Creative Hub** — aparece uma única vez; gerar outra desativa a anterior.
5. No Creative Hub: Configurações → Licença → colar a chave. O Hub baixa e atualiza pelo mesmo endpoint.
6. **Reembolso ou chargeback** na Cakto → o webhook marca o pedido e **desativa a chave e o download** na hora.
   Uma aprovação duplicada atrasada nunca reativa um pedido estornado.

## Peças

| Arquivo | Função |
|---|---|
| `supabase/migrations/20261022_contas_cakto.sql` | Tabelas `creative_orders` e `creative_licenses` (RLS, sem acesso do navegador) e funções só para `service_role`. |
| `lib/accounts/cakto-webhook.js` | `POST /api/cakto/webhook` — HMAC `v1` + campo `secret`, produto/oferta exatos, só compra principal. |
| `lib/accounts/routes.js` | `GET /api/conta/config`, `GET /api/conta/biblioteca`, `POST /api/conta/licenca`. |
| `lib/accounts/supabase.js` | Cliente REST mínimo (Auth + RPC). A `service_role` nunca sai do servidor. |
| `lib/creative-hub-delivery.js` | `GET /api/creative-hub/download` — aceita chave do cliente, chave de teste ou sessão do site com compra paga. |
| `lib/store-checkout.js` | Botão Comprar → Cakto, bloqueado por padrão. |
| `conta.html`, `conta.css`, `conta.js` | Área do cliente. |

Tudo passa pela função única `api/managed-projects.js` (limite de 12 funções do plano Hobby).

## Ativar no Preview (passo a passo)

Nada disso cobra ninguém. Faça primeiro no ambiente **Preview** da Vercel.

### 1. Supabase
1. No projeto Supabase do site: **SQL Editor** → colar e executar `supabase/migrations/20261022_contas_cakto.sql`.
2. **Authentication → URL Configuration**:
   - *Site URL*: `https://portfolio-gustavo-chi.vercel.app`
   - *Redirect URLs*: `https://portfolio-gustavo-chi.vercel.app/conta` e `https://*-gustavo-editor.vercel.app/conta` (prévias).
3. **Authentication → Providers → Email**: manter ligado.
   O e-mail padrão do Supabase tem limite baixo (poucos envios por hora). Antes de vender de verdade,
   configure um SMTP próprio em *Authentication → Emails → SMTP Settings* (ex.: Resend ou Brevo, plano grátis).

### 2. Cakto
1. No produto do Creative Tools: **Integrações → Webhooks → Adicionar**.
   - URL: `https://<domínio>/api/cakto/webhook`
   - Eventos: `Compra aprovada`, `Reembolso`, `Chargeback`.
2. Copie o **segredo** do webhook, o **ID do produto** (UUID) e o **ID da oferta**.
   Dica: use "Enviar teste" e confira no Supabase (`creative_orders`) se o pedido de teste chegou.

### 3. Vercel → Settings → Environment Variables
Cole os valores **direto na Vercel** (nunca no chat, no Git ou em prints). Marque os segredos como *Sensitive*.

| Variável | Valor |
|---|---|
| `ACCOUNTS_ENABLED` | `true` (liga a área `/conta`) |
| `SUPABASE_URL` | `https://<id>.supabase.co` |
| `SUPABASE_ANON_KEY` | chave **anon/public** do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service_role** (Sensitive) |
| `CAKTO_WEBHOOK_SECRET` | segredo do webhook (Sensitive) |
| `CAKTO_PRODUCT_ID` | UUID do produto na Cakto |
| `CAKTO_OFFER_ID` | ID da oferta (vírgula para mais de uma) |
| `CAKTO_EXPECTED_PRICE_CENTS` | opcional, ex. `3990` — recusa pedidos com outro preço |
| `CT_HUB_ENABLED`, `CT_HUB_VERSION`, `CT_HUB_PRIVATE_BLOB_PATH`, `CT_HUB_SHA256`, `CT_HUB_SIZE`, `CT_HUB_PRIVATE_BLOB_TOKEN` | pacote do instalador no Blob privado — ver `CREATIVE-HUB-DISTRIBUTION.md` |
| `CT_HUB_LICENSE_SHA256` | opcional: hashes de chaves de **teste** (beta privada) |

Depois de salvar, faça **Redeploy** da prévia.

Sem configuração, cada rota responde 503 e, fora de produção, lista **apenas os nomes** das variáveis que faltam.

### 4. Teste ponta a ponta
1. Cakto → "Enviar teste" do webhook → pedido aparece em `creative_orders`.
2. Abrir `/conta` na prévia, entrar com o e-mail do pedido → a compra aparece como **ATIVA**.
3. Gerar chave → colar no Creative Hub → instalar.
4. Baixar o instalador pela conta → arquivo verificado.
5. Cakto → reenviar como reembolso → a compra fica **REEMBOLSADA**, a chave para de funcionar.

## Liberar vendas (somente com aprovação do Gustavo)

Na Vercel, ambiente **Production**, por último:

| Variável | Valor |
|---|---|
| `STORE_CAKTO_CHECKOUT_URL` | URL oficial do checkout (`https://pay.cakto.com.br/...`) |
| `STORE_CAKTO_PRICE_CENTS` | ex. `3990` (mostrado na loja) |
| `STORE_CAKTO_DELIVERY_VERIFIED` | `true` só depois do teste ponta a ponta |
| `STORE_CAKTO_SALES_ENABLED` | `true` — **último passo** |

Antes de vender: a Vercel **Hobby** é para uso pessoal, não comercial. Vender pelo site exige o plano **Pro**.

## Operação

- Webhook com erro (503) **não é reenviado automaticamente** pela Cakto: use "Reenviar evento" no histórico.
- Cliente comprou com outro e-mail: ele entra com aquele e-mail. Não há troca de e-mail automática.
- Revogar manualmente: no Supabase, `update creative_licenses set status='revoked', revoked_at=now() where customer_email='...'`.
- Logs nunca registram e-mail, corpo do webhook, assinatura ou chaves.
