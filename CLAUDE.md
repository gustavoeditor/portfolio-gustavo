# CLAUDE.md | Portfolio GUSTAVO®

Você é o desenvolvedor encarregado deste repositório. Responda em português brasileiro. O ChatGPT estrutura as issues e revisa os pull requests quando acionado; você implementa as alterações. Gustavo valida e aprova.

## Escopo
- Site oficial: https://portfolio-gustavo-chi.vercel.app/
- Produção acompanha `main` via Vercel. **Não fazer merge, deploy de produção nem mexer em credenciais por conta própria.**
- Repositório inclui portfólio, G / PLAYER, área `/admin`, API, SEO, biblioteca de mídia, páginas comerciais e conteúdo do Creative Tools.
- **Não colocar o código-fonte do plugin Creative Tools aqui**. O produto terá repositório privado separado.

## Regras
1. Leia `README.md`, `ADMIN-SETUP.md`, `SENTINEL.md`, `vercel.json` e os testes pertinentes antes de editar.
2. Trabalhe sempre em branch temática e pull request; preserve a `main` e mantenha o site atual intacto até aprovação.
3. Proponha a menor alteração que resolve a tarefa. Não refaça o design, remova vídeos ou altere URLs existentes sem pedido específico.
4. Preserve o `/admin`, sessões, uploads, geração de capas e títulos, player, diferentes resoluções de vídeo, links, loja e SEO. Não remova `api/`, `lib/`, `vendor/` nem variantes de mídia.
5. Nunca publicar ou registrar `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, tokens do GitHub ou qualquer segredo. Não alterar autenticação por conveniência.
6. Mantenha compatibilidade com o limite de funções Serverless do plano Vercel; não introduza rotas que possam quebrar o deploy.
7. Execute `npm test` e os checks existentes quando disponíveis. Teste no navegador os fluxos relevantes se o ambiente permitir. Não afirme ter testado produção sem realmente fazê-lo.
8. Não atualizar pagamentos, domínios, dados de clientes, variáveis de ambiente ou produção sem aprovação explícita do proprietário.

## Entrega
O PR deve resumir: problema, causa, arquivos modificados, testes executados/com resultados, riscos e regressões, instruções de validação manual, capturas quando for alteração visual. Se não houver validação real, assinale como não testado.