# Como adicionar vídeos

Abra https://portfolio-gustavo-chi.vercel.app/admin e entre no painel privado.

1. Arraste seu MP4 ou WebM (até 250 MB) para o painel.
2. Confira a capa, título e categoria sugeridos. Você pode ajustar os dados e trocar a capa.
3. Clique em **Publicar no site** e aguarde a confirmação.

Este caminho depende de conectar o Vercel Blob à produção. Se o painel informar que o armazenamento ainda não está conectado, a seleção e a preparação podem ser testadas, mas o botão Publicar fica desativado. Consulte `ADMIN-SETUP.md` para ativar a conexão.

A IA analisa até oito imagens distribuídas pelo vídeo. Ela não avalia o áudio nem assiste ao vídeo completo. Quando indisponível, a sugestão usa o nome do arquivo e pode ser corrigida manualmente.

Soltar o arquivo na página pública exibe uma orientação para abrir o painel; isso não envia o vídeo.

## Caminho manual de reserva

O formulário manual do painel permite preparar uma lista e baixar `projetos.json`. Nesse modo, envie vídeo e capa ao repositório e substitua o JSON por um commit. Esse caminho não publica automaticamente.

Para mídia própria, prefira MP4/H.264 com AAC e Fast Start. WebM também é aceito. Capas manuais: WebP, JPG ou PNG de até 8 MB; prefira cerca de 960 px e tamanho reduzido. Links do YouTube e Vimeo continuam disponíveis no cadastro manual de projetos.
