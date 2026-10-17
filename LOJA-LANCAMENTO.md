# GUSTAVO TRIO — CHECKLIST DE LANÇAMENTO

## Estado inicial: loja publicada como pré-lançamento, SEM cobranças.

Produto inicial: **Gustavo Trio v1.3**, painel CEP para After Effects 2026 no Windows.
Não publicar ZIP no GitHub público, pasta /public, Vercel estático ou arquivos acessíveis por URL direta.

### Antes de permitir qualquer pagamento

1. Testar instalação limpa, Curvas, Bounce, Text Exploder, + CRIAR, PURGE e Presets no After Effects 2026 real, inclusive composições pesadas.
2. Auditar e documentar todas as dependências e direitos autorais. Não incluir arquivos .ffx, logos, bibliotecas e efeitos de terceiros sem licença comercial e de redistribuição.
3. Definir preço e política comercial; confirmar identidade jurídica / contato, suporte, licença, política de privacidade e direitos de arrependimento aplicáveis a vendas digitais no Brasil. Revisão jurídica recomendada.
4. Criar conta Stripe e um produto digital, preço em BRL, Payment Link **de produção**, cartões/PIX se elegível. Associar link ao produto correto; nunca usar link de teste.
5. CONFIGURAR entrega protegida e AUTOMÁTICA após confirmação real do pagamento (integração externa aprovada ou webhook verificado + armazenamento privado). Redirecionamento de sucesso NÃO substitui comprovação de pagamento. Testar também falha, reembolso e cancelamento.
6. Definir as variáveis de ambiente somente na Vercel Production e validar checkout, entrega e emails com compra de teste em ambiente apropriado.
7. Com tudo revisado, configurar:
   - STORE_TRIO_CHECKOUT_URL=https://buy.stripe.com/SEU_LINK_REAL
   - STORE_TRIO_PRICE_LABEL=R$ 79,00  (EXEMPLO; substituir pelo preço verdadeiro)
   - STORE_TRIO_DELIVERY_READY=true   (SOMENTE após entrega real comprovada)
   - STORE_TRIO_SALES_ENABLED=true   (ÚLTIMA variável a ativar)
8. Reimplantar e conferir: GET /api/store/checkout deve retornar available:true somente após as quatro condições; POST deve devolver 303 para o Payment Link correto. Em qualquer outra condição, botão desativado e POST retorna 503.
9. Testar todo o funil de ponta a ponta, direitos do consumidor, comprovantes, suporte, erros e analytics consentidos.

### Proteções
- Nenhum dado de cartão ou identidade é coletado no portfólio.
- Nunca confiar em parâmetro ?paid=true, referrer ou redirect para liberar ZIP.
- O Payment Link não entrega automaticamente um ZIP por si só: configurar fulfillment na plataforma externa.
- A API valida o domínio de checkout e não deixa o cliente escolher redirecionamento.
- Não colocar tokens do Stripe, Vercel ou do armazenamento no navegador ou no GitHub.

### Deploy
PR no GitHub; validar npm test e preview. O projeto Vercel é `portfolio-gustavo` (equipe `gustavo-editor`).
Se a equipe da Vercel responder 403, reconectar permissões; não presumir que PR equivale a deploy. Conferir URL pública após publicar.
