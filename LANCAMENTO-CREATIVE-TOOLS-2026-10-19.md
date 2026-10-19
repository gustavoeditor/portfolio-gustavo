# CREATIVE TOOLS | Lançamento controlado (19/10/2026)

**Status: pré-lançamento, checkout do site BLOQUEADO.** O usuário autorizou implementação técnica e testes, **não** assinatura de planos, ativação de assinaturas, domínio pago nem qualquer nova contratação. Esta documentação nunca equivale a aprovação comercial.

## Avanços efetivamente realizados

- PR #66: botão do site preparado para o checkout Cakto oficial `https://pay.cakto.com.br/g6gcpgr_1217766`, preço esperado R$ 39,90, indisponível por padrão.
- API `POST /api/cakto-webhook`: assinatura oficial HMAC SHA-256 `v1=...`, timestamp +/-5 minutos, corpo cru, limite de 128 KiB. Eventos V1/V2 aprovados: `purchase_approved`, `refund`, `chargeback`. A API exige produto **e** oferta exatos, compra principal e moeda BRL. Nunca grava dados de cartão e nunca usa eventos não assinados.
- Projeto Supabase: migração `supabase/migrations/20261019_cakto_orders.sql` aplicada em 19/10/2026 ao projeto `creative-tools-customers`. Tabelas privadas RLS. Aprovações duplicadas não ressuscitam pedidos estornados; reembolsos revogam licenças e criam bloqueio para licenças futuras.
- GitHub Actions: Quality Gate e Portfolio integrity checks verificados após as alterações. Testes do webhook incluídos em `npm test`.
- Checagem de artefatos: `GUSTAVO_Creative_Tools_v1.4.18_TESTE.zxp` passou nos testes de integridade ZIP, hashes e assinatura OpenSSL; instalador-fonte Go passou em `go test ./...` e `go vet ./...`. **Isso NÃO substitui uma execução em Windows/After Effects real nem um scan Windows Defender.**

## Pendências para liberar uma venda REAL (sem atalhos)

1. **Conformidade Cakto**: solicitar por escrito que a Cakto aceite vender exatamente esta oferta de software + aula prática de instalação; a política de conteúdo exige finalidade educacional. Não afirmar aprovação até receber resposta real.
   - Política: https://www.cakto.com.br/politica-de-conteudo
   - Contato: infoprodutores@cakto.com.br
   - Mensagem sugerida: "Olá! Sou produtor do Creative Tools, extensão digital para Adobe After Effects, acompanhada de aula prática de instalação e uso. Gostaria de confirmar formalmente se uma oferta com licença de software + treinamento é permitida pelas políticas da Cakto, e quais condições de entrega e informações do vendedor são necessárias. Tenho checkout cadastrado e manterei as vendas desativadas até obter confirmação."
2. **Hospedagem**: regularizar uso comercial da Vercel ou migrar para infraestrutura licenciada adequadamente, **sem** contratar nada automaticamente. Em 19/10/2026 consultas autenticadas ao projeto Vercel retornaram 403 para a equipe `gustavo-editor`; conferir permissões da conexão. Plano Hobby é destinado a uso pessoal não comercial.
3. **Instalador final**: verificação Defender atualizada do ZXP e do EXE, instalação UPIA/AE 2026 no Windows, abertura de todos os módulos, reinstalação, remoção e falhas previstas. ZXP 1.4.18 é candidato de teste; EXE v1.5 foi encontrado isoladamente. Nunca embutir/distribuir ZXP sem aprovação de integridade e antivírus.
4. **Entrega real**: configurar Cakto Members ou acesso por e-mail com ZIP/instalador **aprovado** e aula gravada; validar e-mail real, recuperação, suporte e reembolso. O ZXP atual não usa o back-end de ativação de licenças, então **não anunciar chave individual** antes da integração e teste completos.
5. **Pagamento real**: conferir no painel Cakto que produto, ID de produto UUID, oferta ID e valor são os corretos; no momento só se conhece o endereço do checkout fornecido pelo produtor. Não há acesso autenticado ao painel Cakto nesta sessão.
6. **Identificação comercial**: completar publicamente os dados exigidos do fornecedor, canais de atendimento, compatibilidade, versão, condições de atualização, licença, privacidade e política de reembolso, de acordo com legislação aplicável. Conferir cadastro de recebimento e obrigações fiscais.
7. **Teste E2E**: enviar webhook de teste oficial; conferir assinatura raw e registro no Supabase; uma compra válida (segundo as regras da Cakto, sem autoccompra indevida), entrega no e-mail correto, download, instalação, acesso e caminho de estorno. Revisar histórico do webhook para entregas com erro, porque respostas HTTP de falha podem não gerar retentativas automáticas. Não colocar carga ou pagamentos fictícios.

## Variáveis privadas, quando estiver tudo validado

Configuração da rota de venda **no projeto Vercel autorizado, ambiente Production somente após homologação**:
- `STORE_CAKTO_CHECKOUT_URL`: URL oficial (não encurtada).
- `STORE_CAKTO_PRICE_CENTS=3990` somente se confirmado no checkout.
- `CAKTO_PRODUCT_ID`: UUID real da oferta Cakto (nunca inventar).
- `STORE_CAKTO_DELIVERY_VERIFIED=true`: somente se um comprador-testador recebeu e instalou.
- `STORE_CAKTO_LICENSE_VERIFIED=true`: somente se ZXP realmente exige/verifica a chave gerada, ou o requisito for removido após decisão comercial documentada.
- `STORE_CAKTO_SALES_ENABLED=true`: **último passo**, só com todos os anteriores confirmados.

Configuração adicional da **rota de webhook**, manter somente nos segredos server-side:
- `CAKTO_WEBHOOK_SECRET`: segredo gerado pela configuração oficial do webhook; nunca no Git, navegador ou chat.
- `CAKTO_OFFER_ID`: o ID de oferta (`data.offer.id`) confirmado num payload real/testado, não inferir da URL de checkout.
- `SUPABASE_URL`: `https://<id-do-projeto>.supabase.co` no mesmo projeto da migração.
- `SUPABASE_SERVICE_ROLE_KEY`: segredo privado do mesmo projeto, **nunca** usar `NEXT_PUBLIC_`.

O webhook só registra eventos confiáveis e invalida licenças já emitidas: **ainda não envia e-mails nem gera chaves**. O protótipo anterior de chaves Resend foi preservado como material de desenvolvimento separado, não implantado. O fluxo simples de lançamento pode usar entrega gerenciada pela própria Cakto, desde que aceita/homologada; o controle individual via ZXP exigirá trabalho adicional.

### Operação de suporte

- Iniciar a venda somente após verificação de compatibilidade, testes de acesso e atendimento.
- Registrar o mesmo número do pedido usado no painel Cakto para reconciliação.
- Para falhas do webhook, usar histórico oficial e reenvio manual **com assinatura válida**. Não enviar segredos e payloads de clientes para ferramentas públicas.
- Para reclamações, confirmar pagamento no painel antes de enviar arquivo/chave, respeitar regras de privacidade e registrar resolução.
- Fazer backups de documentação, do pacote validado e das instruções de restauração.
- Não confundir métricas de clique com vendas: confirmação deve vir da Cakto.

Fontes:
- https://docs.cakto.com.br/conceitos/webhooks
- https://ajuda.cakto.com.br/pt-br/articles/86-como-cadastrar-o-meu-produto-na-cakto
- https://vercel.com/docs/plans/hobby
