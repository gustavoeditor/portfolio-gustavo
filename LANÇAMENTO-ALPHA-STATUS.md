# Creative Tools Alpha RC1 | Estado de lançamento (18/10/2026)

Esta é a fonte de verdade para a preparação do lançamento em conjunto com `CONFIGURAR-CONTAS-E-CHECKOUT.md` e `MIGRACAO-HIBRIDA-R2.md`.

## Plugin (Alpha RC1)

- Fonte validada: `Creative_Tools_v1.4.16_CRIACAO_DIRETA.zip`, SHA-256 `8bddb13ad82654691f9600a63d96a8e55bde40bc567e470aab07231ec282ae09`.
- Arquivo preparado para o proprietário: `Creative_Tools_Alpha_RC1_v1.4.16_PREPARACAO_Windows.zip`, SHA-256 `ffb70c28e81ef655e369d8bc4112840c3175bcaa53e0a99a1fe6036690c5a072`, 61.249 bytes, 18 arquivos.
- O pacote inclui código CEP sem instaladores que ligam PlayerDebugMode, script oficial de assinatura Adobe pinado com checksum, seis testes JavaScript, relatório de QA e checklist de testes no AE.
- Os seis testes simulados do produto passaram em Node.js neste ambiente.
- **NÃO APROVADO PARA VENDA:** falta ZXP assinado, instalação em Windows sem modo debug, execução real no After Effects, smoke visual do painel, compatibilidade e avaliação final.
- O pacote preparado **não deve ser distribuído ao comprador**. O pacote comercial precisa conter somente ZXP assinado + guia do comprador e checksum do ZXP.

## Site / Stripe / Supabase (sandbox)

- PR #61 continua rascunho e fora de produção; Stripe **Sandbox** e webhook `we_1URw44HHrwaBEYdjZ84hXHBr` foram configurados; webhook secret fica apenas em Vercel Preview.
- O login de Preview pode operar separadamente do checkout. Sem `SUPABASE_SERVICE_ROLE_KEY`, não concede direitos nem libera bibliotecas.
- A URL de retorno do Stripe foi corrigida para manter a origem autorizada da sessão do cliente. `STORE_CUSTOMER_PREVIEW_HOST` é Preview-only.
- O preço de teste no Preview foi alterado para **R$39,00**, ainda **PROVISÓRIO**. Produção não faz cobrança real por meio da rota nova.
- **Bloqueios para testar compra ponta a ponta:** `STRIPE_TEST_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY` configuradas como secrets **Preview**, redirects no Supabase, artefato final aprovado entregue via Blob privado e hash SHA-256 registrado.
- Não autorizar Stripe Live, comercialização, domínio pago, upgrade de Vercel ou envio público do ZXP sem aprovação do proprietário e teste E2E.

## Infraestrutura híbrida

- Vercel é a hospedagem atual; usar Pro quando houver lançamento comercial, sujeito a confirmação de custo e autorização explícita.
- Cloudflare R2 é o destino *proposto* para vídeos públicos; a conta/bucket não foi criado nem existe integração ativa nesta etapa.
- Script read-only `node scripts/plan-hybrid-media.cjs --json` inventaria apenas itens estáticos de `projetos.json`. Mídias do painel `/admin` exigem inventário separado via Vercel Blob.
- Não migrar mídia em produção sem teste e rollback. O ZIP premium permanece em armazenamento privado com autenticação e verificação de licença.
- Nunca incluir chaves de Stripe, Supabase ou R2 em PR, frontend, respostas do assistente ou pacotes de distribuição.

## Estado final

**Em preparação, sem primeira venda e sem checkout real ativado.** O gatilho para disponibilização ao público depende de artefato assinado e testado no AE, login e compra de teste completos, recuperação e revogação, e autorização comercial/custos.
