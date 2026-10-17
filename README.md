# GUSTAVO | EDITOR DE VÍDEO

Portfólio profissional de edição de vídeo, cinematics de CS2, motion design e vídeos para YouTube.

**Site:** https://portfolio-gustavo-chi.vercel.app/

## Conteúdo e experiência

- 16 projetos no catálogo estático, com capas otimizadas e três resoluções de vídeo (480p, 720p e 1080p). Projetos enviados pelo painel privado aparecem adicionalmente no catálogo.
- G / PLAYER: reprodução inline, qualidade/volume persistentes, timeline, tela cheia e atalhos.
- Links individuais compartilháveis para projetos usando `/#projeto-nome-do-video`.
- Seções de trabalhos, estudos de caso, colaborações reais, serviços, processo, FAQ e orçamento via WhatsApp.
- Design responsivo com glow e parallax leves, entradas suaves e suporte a movimento reduzido.
- Catálogo básico legível mesmo com JavaScript desativado; dados estruturados para mecanismos de busca.

## Arquivos que podem ser editados

| Arquivo | Finalidade |
| --- | --- |
| `projetos.json` | Catálogo principal e ordem dos projetos |
| `canais.json` | Canais atuais/anteriores confirmados (não inventar parceiros) |
| `depoimentos.json` | Depoimentos reais com autorização |
| `comparacoes.json` | Comparativos com material e resultado |
| `index.html` | Estrutura do site, SEO e galeria |
| `player.js` / `player.css` | Reprodutor próprio |
| `ambient.css` / `ambient.js` | Iluminação e parallax ornamental |
| `reveal.css` / `reveal.js` | Entrada por opacidade e deslocamento |
| `sales.css` / `sales.js` | Conteúdo comercial, formulário e métricas |
| `quote-modal.css` / `quote-modal.js` | Modal de orçamento e teclado mobile |

As mídias de cada projeto precisam ter o mesmo nome de arquivo nas pastas
`videos/` (720p), `videos-480/` e `videos-1080/`. Elas não são carregadas automaticamente ao abrir a home; o vídeo só começa a baixar quando solicitado.

## Como validar

```bash
npm test
```

A pull request também executa no GitHub Actions testes reais no Chrome: telas pequenas, links, formulário de orçamento até o WhatsApp, fallback sem JavaScript, compartilhamento, versões Full HD, reprodução e acessibilidade WCAG com axe-core.

Para testar localmente a interface com Chrome instalado:

```bash
npm install --no-save playwright-core@1.56.1 axe-core@4.10.3
node scripts/check-mobile-layout.cjs
```

## Deploy e atualizações

A versão oficial está hospedada na **Vercel** e vinculada à branch `main`. É possível que a cota de builds impeça temporariamente a Vercel de publicar novos commits; um **PR mergeado não significa necessariamente que o site público foi atualizado**.

O workflow `.github/workflows/recover-production-viewport.yml` executa uma verificação diária que compara HTML, CSS, JS e dados públicos com o repositório e tenta disparar um novo deploy apenas quando existe diferença. Os retries são limitados para não consumir a cota excessivamente. O fluxo também aceita acionamento manual pelo GitHub Actions.

A auditoria pode ser executada manualmente na CI com `bash scripts/check-production.sh`.

O painel `/admin` depende de `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` nas variáveis de produção da Vercel. Uploads automáticos opcionais dependem de **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`). **Nunca adicione tokens, senhas ou chaves de API ao repositório.** Não promova um deployment de Preview a Production se ele não tiver as mesmas variáveis de ambiente necessárias ao painel.

## Medição de resultados

Os eventos de Web Analytics são anônimos e incluem: abertura do orçamento, briefing iniciado/concluído para WhatsApp, reproduções, vídeos concluídos, compartilhamentos e visitas a canais colaboradores. Eles só produzem relatórios quando a conta/plano Vercel permite recebê-los. Não inventamos taxa de conversão ou resultado comercial.

## Manutenção e conteúdo

Confira `COMO-ADICIONAR-VIDEOS.md` para vídeos e `CANAIS-COLABORACOES.md` para canais. Logos devem ter uso autorizado. Depoimentos, resultados de clientes e métricas nunca devem ser publicados sem confirmação.

O próximo ganho de confiança depende de conteúdo real: logos permitidos dos parceiros, estudos de caso de clientes e depoimentos verificados.

## Abertura Keydrop Treino: qualidades móveis

O vídeo original enviado no `/admin` utiliza Vercel Blob. O processo `scripts/generate-keydrop-renditions.cjs` roda no GitHub Actions e busca o upload publicado chamado **Abertura Keydrop Treino**. Ele gera arquivos MP4 H.264/AAC de 360p e 480p, faz verificação de resolução e SHA-256, e cria `video-renditions/abertura-keydrop-treino.json`. Os dois arquivos são hospedados estaticamente pela Vercel junto com o site, sem sobrescrever o original.

O `G / PLAYER` só ativa os arquivos móveis quando o manifesto corresponde exatamente ao `src` do upload. Em telas pequenas, `Auto` seleciona 360p; 480p e Original são alternativas manuais. Se o manifesto estiver ausente ou o upload for substituído, o vídeo original continua funcionando. Os arquivos das resoluções móveis não devem ser considerados publicados até o CI gerar os MP4 e a produção atualizar.
