# Como adicionar vídeos ao portfólio

## Caminho mais simples

1. Abra o [painel de projetos](https://portfolio-gustavo-chi.vercel.app/gerenciar-projetos.html).
2. Informe o título, categoria, vídeo e, se quiser, uma capa e descrição.
3. Clique em **Adicionar à lista**. Use as setas para ordenar os projetos.
4. Clique em **Baixar projetos.json**.
5. No [repositório do portfólio](https://github.com/gustavoeditor/portfolio-gustavo), substitua o arquivo `projetos.json` pelo arquivo baixado e faça commit.
6. Para arquivos próprios, envie o MP4 para `videos/` e as capas para `capas/` usando **Add file → Upload files** no GitHub. Faça isso antes de publicar o JSON que aponta para esses arquivos.

## Formatos aceitos

- Vídeo próprio: `videos/nome-do-video.mp4`
- Capa opcional: `capas/nome-da-capa.jpg`
- Link público direto de vídeo MP4/WebM
- Link de vídeo do YouTube ou Vimeo, que será exibido incorporado

## Recomendações

- Use nomes curtos, sem acentos nem espaços.
- Prefira MP4/H.264 para compatibilidade.
- A grade tem três colunas no desktop, duas em telas médias e uma no celular.
- O painel salva um rascunho neste navegador, mas não publica sozinho. O site é estático: para as mudanças aparecerem para visitantes, envie os arquivos ao GitHub.
