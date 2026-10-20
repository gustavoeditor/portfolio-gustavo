# Migração híbrida | Vercel + Cloudflare R2 + Supabase + Stripe

**Status: preparo técnico, sem migração nem contratação.** A hospedagem Vercel e os vídeos atuais estão mantidos. O R2 só deve entrar quando existir uma conta Cloudflare autorizada pelo proprietário e após comparação real de custos.

## Arquitetura definida

- **Vercel Pro, no momento comercial**: interface do portfólio, painel de administração, APIs de login, webhook, checkout e downloads protegidos. Não realizar upgrade antes de aprovação específica do preço.
- **Cloudflare R2**: possível destino de **vídeos e thumbnails públicos** de portfólio. Usar domínio de mídia próprio e HTTPS, cache com cabeçalhos de conteúdo corretos e CORS apropriado. Os links de vídeo migrados devem preservar URL, reprodução, desempenho e SEO.
- **Supabase**: identidade, contas, e licenças com RLS. As chaves de servidor nunca vão para código do browser.
- **Stripe**: Checkout hospedado, Sandbox primeiro, e assinatura de webhook validada em bytes brutos.
- **Entrega do plugin comercial**: permanece **privada**, protegida por autenticação, licença Stripe/Supabase e validação SHA-256. **Nunca mover o ZIP premium para bucket público do R2**. Migrar a entrega comercial somente após implementar URL assinada ou backend com verificação equivalente.

## Checklist para Cloudflare R2 (sem efetuar gastos)

1. Proprietário autoriza/cria uma conta Cloudflare gratuita ou conecta um acesso delegado. Antes de adicionar cobrança, confirmar os limites e os possíveis excedentes da política atual.
2. Criar bucket R2 para **mídia pública apenas** e configurar domínio próprio de mídia. Verificar necessidade de cartão de crédito. Não armazenar a chave de API no repositório nem no ChatGPT.
3. Rodar `node scripts/plan-hybrid-media.cjs --json` para enumerar o catálogo **estático** do portfólio.
4. Complementar inventário usando a lista do painel privado `/admin` e dados do Vercel Blob; **não** excluir/renomear conteúdo original antes de conferir os itens administrados.
5. Copiar os objetos para R2 com verificação por tamanho e SHA-256, mantendo original intacto. Configurar `Content-Type`, Range e cache apropriados.
6. Testar vídeos, poster, celular, largura de banda, resposta 206 para streaming, URL em domínio próprio, cache e reproduções repetidas em Preview.
7. Habilitar um **feature flag** e substituir somente as URLs verificadas por destino R2; rollback deve restaurar imediatamente o Vercel Blob.
8. Após uma janela de estabilidade, comparar Vercel Blob/R2 e decidir se vale transferir também os uploads futuros. Não desativar Blob ou OIDC sem substituir todo o fluxo do `/admin`.

## Orçamento e riscos

- Não assumir zero custo eterno. R2 tem cotas de armazenamento e operações; eventuais excedentes e o Vercel Pro podem cobrar em moeda estrangeira.
- Verificar plano Vercel Pro obrigatório para o lançamento comercial (Hobby não permite uso comercial).
- A aprovação da **estratégia** não é autorização para adicionar forma de pagamento, assinar plano pago ou habilitar Stripe Live.
- Nenhuma migração deve afetar os vídeos atuais da produção.
