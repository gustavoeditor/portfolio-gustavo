# Creative Tools | Contas e checkout de teste

## Escopo e estado

Versão do produto: **Creative Tools v1.4.16** para Windows / After Effects 2026.

Preço planejado **provisório**: **R$ 79,00 (7900 centavos)**. Não foi feita uma aprovação de preço final, nem habilitada cobrança real. O único pagamento previsto por esta implementação é via **Stripe TEST**, em um **Preview** da Vercel, após configuração manual das credenciais.

O fluxo existente `/api/store/checkout` e a página `/receber.html` continuam isolados. Não altere os flags de vendas legados enquanto a nova loja não for validada.

## Preparação Supabase

1. **CONCLUÍDO em 17/10/2026**: projeto Supabase `creative-tools-customers`, ID `orsgwajmgrozaujakcyh`, organização `gustavoeditor's Org`, região São Paulo (`sa-east-1`), custo indicado US$ 0/mês na criação. URL pública: `https://orsgwajmgrozaujakcyh.supabase.co`. O projeto está em `ACTIVE_HEALTHY`.
2. **CONCLUÍDO**: a migração **database/customer-entitlements.sql** foi aplicada. Auditoria de segurança sem avisos; a tabela está inicialmente vazia, com RLS. Permissões verificadas: `anon` não lê nem escreve, `authenticated` apenas lê as próprias licenças, `service_role` pode gravar do servidor.
3. **PENDENTE: requer o painel Supabase**, em **Authentication > URL Configuration**, configurar o Site URL do ambiente de testes e permitir **exatamente** os endereços Preview que serão usados e `https://portfolio-gustavo-chi.vercel.app/conta.html` somente quando estivermos prontos para publicar. Os links precisam abrir no mesmo navegador que solicitou login PKCE.
4. **PENDENTE: credenciais OAuth**. Em Authentication > Providers: configurar **Google** e **Discord** usando os Client IDs/Secrets de aplicativos criados pelo proprietário. Redirect URI para cada app OAuth: `https://orsgwajmgrozaujakcyh.supabase.co/auth/v1/callback`. Ativar **e-mail OTP/Magic Link** e entrega de e-mail confiável antes de uso real. Não incluir segredos OAuth no frontend.
5. Publicar o URL (publicável) e anon/publishable key do Supabase no Preview da Vercel. A chave `SUPABASE_SERVICE_ROLE_KEY` deve ficar **exclusivamente no servidor**, tipo sensitive, nunca exposta no site.
6. Fazer cadastro e autenticação de teste no domínio Preview. Confirmar isolamento por usuário, reentrada e expiração de sessão.

**Vercel disponível em 18/10/2026:** o conector conseguiu gerenciar variáveis sem o parâmetro explícito da equipe. `SUPABASE_URL` e `SUPABASE_ANON_KEY` foram configuradas somente no ambiente Preview. Credencial de servidor Supabase, OAuth e Stripe TEST ainda estão pendentes. Vendas reais não foram habilitadas.

## Ambiente Preview da Vercel

As configurações abaixo **não devem ser adicionadas à produção nesta etapa**:

| Variável | Necessidade |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto `*.supabase.co` |
| `SUPABASE_ANON_KEY` | Chave pública/publishable de autenticação |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave **secreta**, só servidor |
| `STORE_CUSTOMER_GOOGLE_ENABLED` | `true` somente após Google OAuth efetivamente configurado |
| `STORE_CUSTOMER_DISCORD_ENABLED` | `true` somente após Discord OAuth efetivamente configurado |
| `STORE_CUSTOMER_TEST_ENABLED` | `true` apenas no Preview após validações |
| `STORE_CUSTOMER_PRICE_CENTS` | `7900` para R$79,00 de teste |
| `STRIPE_TEST_SECRET_KEY` | Credencial **`sk_test_...`**, nunca `sk_live_...` |
| `STRIPE_TEST_WEBHOOK_SECRET` | Assinatura `whsec_...` do endpoint de teste |
| `STORE_TRIO_PRIVATE_BLOB_TOKEN` | Token do Vercel Blob para **leitura privada** |
| `STORE_TRIO_PRIVATE_BLOB_PATH` | Caminho `products/gustavo-trio/creative-tools-v1.4.16.zip` |
| `STORE_TRIO_RELEASE_SHA256` | SHA-256 **exato** do ZIP hospedado |

Arquivo analisado `Creative_Tools_v1.4.16_CRIACAO_DIRETA.zip`:
```text
SHA-256: 8bddb13ad82654691f9600a63d96a8e55bde40bc567e470aab07231ec282ae09
Tamanho: 57380 bytes
```
O caminho acima é uma sugestão, mas o conteúdo armazenado deve ser **o mesmo ZIP** e seu checksum precisa coincidir. Não comitar o ZIP na raiz pública da hospedagem. O token de Blob deve ter permissão estritamente necessária.

## Stripe TEST, entrega e recuperação

1. Na conta Stripe escolhida, entrar em modo de testes, obter secret key `sk_test_...`, sem criar pagamentos em Live Mode.
2. Configurar Webhook de teste para `https://DOMINIO-PREVIEW.vercel.app/api/customer/webhook` com eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
3. Configurar segredo de assinatura em `STRIPE_TEST_WEBHOOK_SECRET`.
4. Fazer uma compra **com cartões de teste**, nunca com cartão real. O checkout usa session `cs_test_...`, vinculada ao ID Supabase do comprador, e preço controlado pelo servidor.
5. A autorização é registrada somente após validação de pagamento, produto, cliente e valor. O retorno `/conta.html?session_id=...` faz a reconciliação; o webhook é a alternativa caso a aba seja fechada.
6. Baixar na biblioteca: o backend confirma login Supabase, direito na tabela, pagamento Stripe não reembolsado/disputado, ZIP privado e SHA-256 antes de responder.
7. Repetir testes de usuário diferente, checkout cancelado, pagamento pendente, webhook duplicado, compra reembolsada, arquivo alterado, sessão expirada e download indevido.

O limite de **12 funções do Vercel Hobby** é respeitado: todas as seis rotas novas de cliente passam pela função existente `/api/managed-projects`. Não criar novos arquivos dentro de `api/` sem recontar funções.

## Segurança e publicação

- **Não ligar Stripe Live ou STORE_TRIO_SALES_ENABLED** durante a fase de teste.
- A `service_role` do Supabase e as secret keys Stripe só existem nas variáveis privadas da Vercel.
- Os dados de cartão nunca são coletados pelo site, apenas pela página hospedada do Stripe.
- Ao publicar a autenticação real, revisar restrições RLS, políticas LGPD, prazo de retenção, direito de exclusão, suporte, reembolso e política de atualizações.
- Todos os deploys exigem CI aprovado e confirmação de READY na Vercel.
- Uma conta autenticada **não libera automaticamente** qualquer produto: a licença é vinculada a uma sessão de checkout Stripe verificada.
- Se o acesso ao projeto da Vercel continuar retornando 403, recuperar permissões de projeto no time correto; não compartilhar segredos no GitHub nem aqui no chat.

## Cobrança real

**Bloqueada por projeto** nesta fase: `api/customer/checkout` valida `VERCEL_ENV==='preview'`, `STORE_CUSTOMER_TEST_ENABLED==='true'` e uma chave `sk_test_...`; produção não pode executar esse checkout mesmo que alguém encontre o endereço. A futura passagem a produção deve passar por uma revisão adicional explícita de segurança, impostos e operação comercial.
