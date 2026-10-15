# Painel privado de vídeos

O painel é servido por uma Vercel Function e exige uma sessão assinada no servidor. A página HTML administrativa não é mais publicada como arquivo estático.

## Configuração obrigatória na Vercel

Em **Project Settings → Environment Variables**, configure estas duas variáveis para **Production, Preview e Development**:

- `ADMIN_PASSWORD`: uma senha longa e exclusiva para o painel.
- `ADMIN_SESSION_SECRET`: um segredo aleatório longo (pelo menos 32 bytes).

Não use prefixo `NEXT_PUBLIC_` nem coloque esses valores no GitHub. Depois de salvar, faça um novo deploy para que as funções recebam as variáveis.

A aplicação falha fechada: se qualquer variável estiver ausente, o painel não é servido e o login informa que a configuração está pendente.

Acesse o login por `/admin`. O endereço do painel continua sendo `/gerenciar-projetos.html`, mas só funciona com um cookie de sessão assinado, HttpOnly, Secure e SameSite=Strict, com validade de 12 horas. O painel continua exportando o `projetos.json`; ele não publica arquivos sozinho.
