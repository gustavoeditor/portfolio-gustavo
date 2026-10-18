# Primeira venda Creative Tools | Cakto (checkout hospedado)

## Nova rota simplificada

**Estratégia para a primeira Alpha comercial:** o portfólio GUSTAVO® apresenta o produto, a página `/loja.html` disponibiliza um botão e o comprador é redirecionado à **Cakto** (`pay.cakto.com.br`) para efetuar o pagamento. A Cakto deve ficar responsável por disponibilizar o download com confirmação do pagamento, preferencialmente pela entrega por e-mail ou área de membros. Isso não exige login no portfólio, Stripe, Supabase ou webhook próprio para a primeira venda.

Todo o checkout antigo Stripe, o PR de contas #61, vídeos, uploads, Sentinel e admin continuam preservados e desligados onde necessário. **Nenhum pagamento real foi ativado.**

## Passo a passo que depende do proprietário

1. Acesse https://app.cakto.com.br/ e crie/acesse sua conta de produtor. Acesse **Produtos > Adicionar produto**.
2. Cadastre **Creative Tools Alpha**, descrição e página de vendas `https://portfolio-gustavo-chi.vercel.app/loja.html`. Use o preço de lançamento **aprovado pelo proprietário**; os R$39 usados no Preview são apenas uma hipótese, não preço de venda autorizado.
3. **Não selecione mera entrega de serviços**. Selecione *Acesso por e-mail* com arquivo/link disponibilizado pela plataforma **ou Cakto Members**, conforme a capacidade da conta para distribuir o ZXP e o manual. O pacote deve ser a Alpha homologada e **assinada**; não publique ZIP de testes com `PlayerDebugMode`.
4. Faça um teste controlado da entrega em sua conta, sem assumir que o link no e-mail é privado/irreplicável. Confira recuperação de acesso, reembolso, suporte e o que aparece ao comprador.
5. Abra o produto > **Links** (ou menu de três pontos > Ver links) e copie a **URL real de checkout** `https://pay.cakto.com.br/...`. Não usar a URL de outro vendedor e não inventar um caminho.
6. Somente após produto assinado, entrega, informações de compra, condições comerciais e hospedagem comercial aprovados, configure estas variáveis no **Production** da Vercel:
   - `STORE_CAKTO_CHECKOUT_URL`: URL exata e oficial da oferta no domínio `pay.cakto.com.br`.
   - `STORE_CAKTO_PRICE_CENTS`: preço em centavos confirmado na Cakto, exemplo `3900` para R$39.
   - `STORE_CAKTO_DELIVERY_READY=true`: somente depois de entrega real verificada.
   - `STORE_CAKTO_SALES_ENABLED=true`: flag final para ligar o botão.
   - `STORE_TRIO_COMMERCIAL_HOSTING_APPROVED=true`: somente após a hospedagem ser aprovada para uso comercial, respeitando as condições do serviço.
7. Conferir `GET /api/store/checkout` (`available:true`, `provider:'cakto'`, `priceLabel` igual ao checkout real); o formulário existente `POST /api/store/checkout` deve retornar `303` para o domínio autorizado. Confirmar navegação manual no celular e desktop e a entrega pós-compra.
8. Fazer um teste de compra autorizado pelo proprietário e confirmar a entrega; **não ligar nenhum flag antes desta preparação e aprovação**.

## Como o código evita a venda prematura

- Todo o fluxo Cakto é fechado por padrão; faltando URL, valor, entrega, permissão comercial ou flag final, retorna indisponível e não redireciona.
- A URL da oferta deve usar HTTPS, host exato `pay.cakto.com.br`, sem credenciais no endereço e sem fragmentos. Não admite domínio parecido ou injeção pelo navegador.
- Enquanto `STORE_CAKTO_SALES_ENABLED=true`, qualquer erro nas configurações da Cakto **não** faz fallback para checkout Stripe.
- A página pública não contém segredos ou parâmetros de pagamento. Nenhum endpoint da Cakto recebe dados de visitante via back-end do portfólio.
- Um simples link terceirizado não informa ao nosso SENTINEL se houve compra; conversões poderão ser acompanhadas primeiramente pela Cakto e, futuramente, por integração oficial segura, sujeita a consentimento.

## Referências oficiais

- Cadastro de produto e modalidade de entrega: https://ajuda.cakto.com.br/pt-br/articles/86-como-cadastrar-o-meu-produto-na-cakto
- Onde copiar a URL da oferta: https://ajuda.cakto.com.br/pt-br/articles/79-como-pegar-o-link-de-checkout-do-meu-produto-na-cakto
- Informações de taxas e condições: https://www.cakto.com.br/taxas

A Cakto pode alterar taxas, regras de reserva, produto aceito e condições de aprovação. Conferir o painel antes de vender. Nenhuma conta, contratação ou credencial foi criada por este commit.
