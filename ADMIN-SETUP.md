# Painel privado e publicação de vídeos

Site: https://portfolio-gustavo-chi.vercel.app/

Painel: https://portfolio-gustavo-chi.vercel.app/admin

## Uso

1. Entre com sua senha administrativa. Se a autenticação em duas etapas estiver configurada, informe também o código do seu autenticador.
2. Arraste um MP4 ou WebM, de até 250 MB, para o painel. Soltar um arquivo fora da caixa de envio dentro do painel também seleciona o vídeo.
3. O navegador captura oito quadros distribuídos pelo vídeo e cria uma capa. Se o formato não puder ser decodificado, selecione uma capa manualmente.
4. Confira título, categoria, descrição e posição. A análise visual usa imagens, não o áudio nem o vídeo completo. Quando a IA não está disponível, a interface informa que a sugestão usa o nome do arquivo.
5. Clique em **Publicar no site**. Aguarde a confirmação de publicação.

Na página pública e na tela de login, soltar um arquivo não abre mais o vídeo no navegador: aparece uma orientação para usar o painel privado. Nenhum visitante pode publicar sem autenticação.

Após uma falha de publicação, use novamente o botão Publicar mantendo a aba aberta: os arquivos já enviados são reaproveitados e um identificador impede duplicação do projeto. Recarregar a aba perde esse estado temporário; vídeos incompletos podem ficar no armazenamento e ser removidos pelo proprietário depois de conferir o catálogo.

## Conectar o armazenamento — etapa ainda necessária em produção

O último teste público, antes destas melhorias, retornou `enabled: false`. Isso confirma que o armazenamento não estava ativo. O acesso da integração ao time `gustavo-editor` também retornou HTTP 403. O código não ativa a conta nem cria o armazenamento sozinho.

Abra o projeto **portfolio-gustavo** no time **gustavo-editor** da Vercel, entre em **Storage**, crie ou selecione um **Blob público** e conecte-o ao ambiente **Production**. Mantenha o armazenamento na conta proprietária e confira os limites de armazenamento e transferência do plano.

O painel aceita dois tipos de conexão:

- **Conexão por token:** variável privada `BLOB_READ_WRITE_TOKEN`.
- **Conexão por OIDC:** `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` e o `VERCEL_OIDC_TOKEN` disponibilizado pela Vercel. O upload usa URLs assinadas com limite de caminho, tipo e tamanho. Conecte pelo painel da Vercel para que as variáveis sejam provisionadas corretamente.

Após conectar, faça **Redeploy** de produção e recarregue o painel. Não publique o valor de nenhum token no repositório ou no chat.

O código dos dois modos foi testado com serviços simulados. O upload real em produção só pode ser confirmado depois que o armazenamento da conta estiver conectado.

## Análise visual

A prioridade de autenticação é:

1. `OPENAI_API_KEY` já configurada, com modelo `OPENAI_VISION_MODEL` ou `gpt-4.1-mini`.
2. Vercel AI Gateway, usando `AI_GATEWAY_API_KEY` ou OIDC da implantação, com `AI_GATEWAY_MODEL` ou `openai/gpt-4.1-mini`.

A disponibilidade de credenciais não garante saldo ou acesso do provedor. A conta da Vercel pode exigir verificação ou créditos para utilizar o Gateway. Se o serviço recusar a análise, o painel continua permitindo escolher os dados manualmente e informa a origem da sugestão. Não é obrigatório contratar outro serviço para publicar manualmente.

Nenhuma chave deve ir para o front-end. O código do cliente de upload é empacotado no próprio site em `vendor/blob-client.js`, sem importar scripts de um CDN externo no painel.

## Segurança

- `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` são obrigatórios e privados.
- Cookies `HttpOnly`, `Secure`, `SameSite=Strict`, validade de 12 horas. Alterar senha ou segredo do autenticador invalida as sessões anteriores.
- As operações administrativas verificam a sessão e a origem. A publicação e análise exigem também um cabeçalho exclusivo do painel.
- O login limita a dez tentativas por 15 minutos, por endereço de origem e instância. Esse limite em memória é suplementar e não representa proteção global entre todas as instâncias.
- Para tornar o limite compartilhado, conecte Upstash Redis e configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. Se Redis estiver configurado mas indisponível, novos logins são recusados temporariamente.
- Para ativar autenticação em duas etapas, cadastre um segredo Base32 do autenticador na variável privada `ADMIN_TOTP_SECRET` e no seu app de autenticação, usando TOTP/SHA-1, seis dígitos, período de 30 segundos. Guarde uma cópia segura fora do site antes de ativar. A simples publicação do código não ativa essa opção.
- Arquivos publicados precisam pertencer ao Blob deste portfólio, ter tipo/tamanho permitidos e assinatura binária compatível com vídeo ou imagem. Essa validação não é um antivírus.
- O catálogo usa gravação condicional por ETag para evitar sobrescrever alterações feitas em outra aba. Se houver conflito, a publicação pede uma nova tentativa.
- Antes de alterar um catálogo existente, uma cópia imutável da versão anterior é salva em `gustavo-admin/history/`. Os snapshots contêm apenas os mesmos dados públicos do catálogo. Para recuperar, o proprietário pode consultar essas cópias no Blob e restaurar os registros desejados. Ainda não há um botão de restauração no painel.
- Retirar um projeto do site preserva o arquivo original. Os 17 vídeos estáticos permanecem no `projetos.json` e são mantidos caso o armazenamento esteja indisponível.
- Cabeçalhos impedem incorporar o site em frames e restringem objetos, base de URLs e envio de formulários. O painel tem política de scripts e conexões mais restrita.

Estas camadas reduzem o risco; não são uma garantia de impossibilidade de invasão. O gerenciamento de conta da Vercel e GitHub, suas permissões e autenticação em duas etapas também dependem do proprietário.

## Desenvolvimento e validação

```sh
npm ci
npm run build:upload-client
npm test
```

`npm test` valida o portfólio, a resolução de fotos dos canais e cenários de autenticação, limitação de tentativas, TOTP, autorização de upload, validação de mídia, conflitos do catálogo, publicação idempotente e fallback da análise visual. Os testes de serviços usam simulações, sem credenciais reais.
