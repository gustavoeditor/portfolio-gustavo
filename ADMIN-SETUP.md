# GUSTAVO | Painel privado e publicação inteligente

O portfólio continua público em **https://portfolio-gustavo-chi.vercel.app/**. Não é necessário comprar nem conectar domínio próprio para publicar vídeos automaticamente.

## 1. Entrar no painel

Abra **https://portfolio-gustavo-chi.vercel.app/admin** e entre usando a senha administrativa.

A senha `ADMIN_PASSWORD` já foi cadastrada no ambiente **Production** do projeto na Vercel. A chave `ADMIN_SESSION_SECRET` também está cadastrada. **Não coloque esses valores no GitHub nem os envie por mensagem.**

O painel é servido por uma Function protegida no servidor. A sessão usa cookie `HttpOnly`, `Secure`, `SameSite=Strict` e expira após 12 horas. O login antigo permanece funcionando.

## 2. Ativar envio automático de arquivos

Acesse o projeto `portfolio-gustavo` na Vercel → **Storage** → **Create Database** → **Blob**.

- Escolha um nome, por exemplo `gustavo-portfolio-media`.
- Use **Public**, já que os vídeos do portfólio precisam ser acessíveis pelos visitantes.
- **Conecte o Blob ao projeto `portfolio-gustavo`**.
- Ative a conexão para **Production**. A Vercel deve criar a variável privada `BLOB_READ_WRITE_TOKEN` automaticamente.
- Faça **Redeploy** da produção após conectar o armazenamento. Confirme que a variável está presente em **Settings → Environment Variables**, sem revelar seu valor.

*O assistente tentou criar o Blob automaticamente em 15/10/2026, mas a integração da Vercel recusou a ação com HTTP 403. Esta etapa precisa ser concluída pela conta proprietária do projeto ou após reconectar a integração com acesso ao time `gustavo-editor`.*

Após o deploy, o painel deve exibir **Armazenamento conectado**. Sem esse token, o botão de publicar permanece desativado. Os 17 vídeos atuais continuam exibidos normalmente.

### Publicar um vídeo

1. Entre no painel e arraste um MP4 ou WebM (até 250 MB).
2. O navegador captura quadros e gera uma capa pequena. Opcionalmente, substitua a capa por JPG/PNG/WebP de até 8 MB.
3. O painel sugere título, categoria e posição. Confira essas sugestões, especialmente se o vídeo tiver um nome genérico.
4. Clique em **Publicar no site** e aguarde a barra chegar a 100%.
5. Recarregue o portfólio. Novos vídeos aparecem integrados aos 17 já publicados, sem um novo commit.

Arquivos são enviados diretamente do navegador para o Blob usando um token temporário emitido **somente após autenticação**. Os dados do catálogo são mantidos na Vercel Blob. A publicação não exige abrir o GitHub Desktop.

## 3. Ativar IA visual de classificação (opcional)

Sem uma chave de IA, o painel já faz uma **sugestão básica pelo nome do arquivo**, mas isso **não é análise visual por IA**.

Para analisar até três quadros do vídeo, adicione na Vercel → Settings → Environment Variables:

- `OPENAI_API_KEY`: uma chave privada da API da OpenAI, **apenas em Production**, criada pelo proprietário e armazenada como Sensitive.
- Opcional: `OPENAI_VISION_MODEL`, padrão `gpt-4.1-mini`.

Faça redeploy após salvar. O painel indicará **IA visual disponível**. O serviço usa a API de visão e pode gerar custos conforme o uso da API. As sugestões podem errar: sempre confira antes de publicar. A IA analisa **quadros capturados**, não toda a edição, o movimento ou o áudio.

## 4. Segurança e manutenção

- Nunca grave senhas ou tokens no front-end.
- Não publique o conteúdo de `.env` no GitHub.
- A API de upload rejeita solicitações de visitantes não autenticados.
- A API de publicação valida se vídeo e capa estão no armazenamento Blob do projeto.
- O catálogo público antigo `projetos.json` não é apagado. Se Blob falhar, os vídeos já existentes permanecem visíveis.
- Retirar um projeto pelo painel remove apenas a referência pública do catálogo. O arquivo original permanece no armazenamento para eventual recuperação; remova arquivos órfãos pelo dashboard do Blob se necessário.
- O antigo modo manual/exportação JSON permanece no painel.
- O acesso a um domínio `.vercel.app` é suficiente, porém o site precisará estar publicamente acessível para os visitantes.

## 5. Limites e custos

Vercel Blob está disponível nos planos compatíveis e pode cobrar por armazenamento, transferência e operações conforme a assinatura. Confira **Storage → Usage** e os limites do plano antes de publicar arquivos muito grandes.

Os vídeos MP4 existentes continuam hospedados via GitHub/Vercel. Somente os uploads novos usam Blob.
