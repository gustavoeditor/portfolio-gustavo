# GUSTAVO TRIO — MANUAL DE PUBLICAÇÃO COMERCIAL

Estado atual: **pré-lançamento, compras desligadas**. Este repositório contém a vitrine e a API de entrega, mas **NÃO** contém o ZIP comercial nem segredos. Não publicar o arquivo do produto em diretórios públicos.

## Bloqueadores reais
- Vercel Hobby não pode ser usado para atividade comercial. Antes de cobrar, utilizar hospedagem/plano autorizado (conferir https://vercel.com/docs/limits/fair-use-guidelines); não alterar variáveis de liberação enquanto isso não estiver resolvido. Nenhuma alteração de plano está autorizada automaticamente.
- Instalação, compatibilidade, direitos autorais, dados do fornecedor, termos, suporte e política de arrependimento precisam de validação humana apropriada.
- A edição de desenvolvimento v1.3 contém instalador **para testes** que ativa PlayerDebugMode. Para distribuição, gerar e verificar um ZXP assinado usando ZXPSignCmd conforme documentação Adobe. Não vender o ZIP de teste.
- Para entrega automática, usar **Blob PRIVADO** separado do armazenamento público de vídeos. Um Blob público não é adequado.

## Arquitetura sem funções Vercel adicionais
- `GET /api/store/checkout`: informa disponibilidade apenas quando TODOS os bloqueios técnicos são liberados.
- `POST /api/store/checkout`: redireciona por 303 ao link de pagamento permitido.
- `/receber.html?session_id={CHECKOUT_SESSION_ID}`: comprador faz download após o retorno da Stripe.
- `GET /api/store/download?session_id=...`: confirma a sessão diretamente na Stripe, compara produto/valor/moeda, confirma PaymentIntent e Charge sem reembolso/disputa e transmite o ZIP de Blob privado pelo servidor. Não confia em parâmetros `paid=true`, URL do Blob informada pelo visitante ou redirecionamento de sucesso.
- Download via sessão válido por até **48 horas** após o pagamento; definir canal de suporte para recuperar acesso depois desse período. O link é uma credencial temporária e não deve ser divulgado.

## Configuração de Preview (Stripe SANDBOX, sem cobrança real)
Definir SOMENTE no ambiente Preview da Vercel:
- `VERCEL_ENV` é fornecido automaticamente pela Vercel e deve ser `preview`.
- `STORE_TRIO_TEST_MODE=true`
- `STORE_TRIO_SALES_ENABLED=true` (apenas no ambiente de teste)
- `STORE_TRIO_DELIVERY_READY=true` (apenas quando o ZIP privado de teste existir)
- `STORE_TRIO_CHECKOUT_URL` = Payment Link **de testes** em `https://buy.stripe.com/...`
- `STORE_TRIO_STRIPE_PAYMENT_LINK_ID` = ID `plink_...` do mesmo link de testes
- `STORE_TRIO_PRICE_CENTS` = preço EXATO em centavos de BRL, sem separadores (exemplo hipotético: 7900)
- `STRIPE_SECRET_KEY` = chave **de testes**, apenas variável secreta da Vercel
- `STORE_TRIO_PRIVATE_BLOB_TOKEN` = credencial de leitura do Blob **privado** de testes
- `STORE_TRIO_PRIVATE_BLOB_PATH` = caminho fixo `products/gustavo-trio/NOME-DA-VERSAO.zip`

Na Stripe, definir **After payment → Redirect** para:
`https://SEU-DOMINIO-DE-PREVIEW/receber.html?session_id={CHECKOUT_SESSION_ID}`

Validar pagamento de teste, cancelamento, pagamento incompleto, valor errado, outro produto, reembolso, disputa, link compartilhado, expiração em 48h, ZIP instalado e falha de rede. A API recusa sessões de teste em Produção.

## Configuração de Produção (somente depois de todos os requisitos)
- Hospedagem/plano com uso comercial permitido e comprovado.
- Conta Stripe real vinculada ao vendedor; produto e preço definidos em BRL e impostos analisados.
- Cliente recebe nota/recibo e condições de compra apropriadas; configurar comunicações e suporte.
- Publicar o **arquivo assinado e homologado** em Blob privado de produção.
- `STORE_TRIO_TEST_MODE` **ausente ou false**
- `STORE_TRIO_CHECKOUT_URL` = Payment Link real
- `STORE_TRIO_STRIPE_PAYMENT_LINK_ID` = ID do link real
- `STORE_TRIO_PRICE_CENTS` = preço real do link (ex.: 7900 somente se aprovado)
- `STRIPE_SECRET_KEY` = segredo LIVE (nunca compartilhar no chat ou GitHub)
- `STORE_TRIO_PRIVATE_BLOB_TOKEN` = token do Blob PRIVADO de produção
- `STORE_TRIO_PRIVATE_BLOB_PATH` = caminho do ZIP assinado, sob `products/gustavo-trio/`
- `STORE_TRIO_DELIVERY_READY=true` **após comprovar entrega no teste**
- `STORE_TRIO_COMMERCIAL_HOSTING_APPROVED=true` **apenas após comprovar permissão de uso comercial**
- `STORE_TRIO_SALES_ENABLED=true` **última variável a ativar**

Na Stripe, configurar o redirect:
`https://portfolio-gustavo-chi.vercel.app/receber.html?session_id={CHECKOUT_SESSION_ID}`
(se o domínio mudar, usar o domínio final aprovado).

NÃO enviar os tokens em arquivos HTML, mensagens, screenshots ou commits. Não executar uma venda real até que entrega e política comercial estejam verificadas. Não ativar planos ou cobranças sem consentimento explícito.

## Proteções e limitações
- A sessão Stripe funciona como um comprovante temporário; quem recebe o link poderá baixar até a expiração. A primeira edição não implementa conta de comprador ou controle antifraude avançado.
- Reembolsos e disputas são consultados pelo estado atual do Charge antes de liberar o ZIP.
- Arquivos .ffx e efeitos de terceiros não fazem parte da licença do Gustavo Trio, e devem ficar fora do pacote.
- Em caso de falha no provedor de pagamento ou no Blob, a entrega responde com erro; não libera conteúdo sem validação.
- Ainda faltam auditoria jurídica, testes no After Effects real, assinatura ZXP e integração com a conta real antes da venda.
- Antes de uma grande venda, configurar monitoramento, suporte e reentrega durável (além do link de 48h).

## QA / CI
Rodar `npm test`, `node --test tests/store-delivery.test.cjs` e testes em Chrome. Validar no final `GET /api/store/checkout` (deve retornar `available:false` enquanto bloqueado) e `POST /api/store/checkout` (503).
Os caminhos `/api/store/*` compartilham a função serverless existente `/api/managed-projects` via rewrites: não aumentam a contagem de funções Vercel.
