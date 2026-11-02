# Creative Tools Update Center

Esta branch prepara a central pública `/atualizacoes.html` e o manifesto `/updates/creative-tools/manifest.json`.

## Estado atual
**Sem binário oficial publicado.** Não marcar `latest` nem liberar botão de download até possuir o instalador Alpha real, com testes e SHA-256. O feed não é prova de que o aplicativo Windows esteja integrado.

## Contrato de publicação
```json
{
  "schemaVersion": 1,
  "product": "creative-tools",
  "channel": "alpha",
  "latest": "0.1.1-alpha.1",
  "releases": [{
    "version": "0.1.1-alpha.1",
    "date": "AAAA-MM-DD",
    "changes": ["Correção da câmera"],
    "downloadUrl": "https://URL-OFICIAL-HTTPS/creative-tools-0.1.1-alpha.1.zip",
    "sha256": "64 caracteres hexadecimais"
  }]
}
```
**Exemplo apenas. Não publicar o exemplo como release.**

## Regras para o instalador Windows
1. Fazer HTTPS GET do manifesto no domínio oficial, com timeout, sem executar conteúdo remoto.
2. Comparar versões SemVer (inclusive pré-lançamento), canais separados e versão mínima do instalador.
3. Baixar para diretório temporário; validar tamanho, SHA-256 e assinatura de código quando disponível.
4. Recusar ZIP traversal, links simbólicos, caminhos absolutos e arquivos fora do diretório permitido.
5. Exigir After Effects fechado antes de substituir arquivos da extensão.
6. Criar backup; instalar atomicamente; em falha, restaurar backup.
7. Exibir notas e pedir confirmação; não atualizar silenciosamente.
8. Manter instalador e plugin separados, com botão Reparar e Desinstalar.
9. Servir downloads somente depois de validação e autorização de distribuição; não expor pacotes pagos em Blob público.
10. Publicar versão em branch, executar testes, conferir preview READY e produção READY antes de anunciar.

## Bloqueio
O código-fonte do instalador Alpha atualmente distribuído ainda não está no repositório. É necessário incorporá-lo para implementar o cliente de atualização e a instalação automática reais.

## Creative Hub (download com licença)

O Creative Hub lê `updates/creative-tools/hub-manifest.json` e baixa por
`GET /api/creative-hub/download?product=creative-tools&version=<versão>` com `Authorization: Bearer <licença>`,
em partes (HTTP Range, até 4 MB por resposta). O endpoint (`lib/creative-hub-download.js`) só entrega se:
a release estiver `published` com `auth: "license"` no feed, a licença bater com um hash de
`CT_HUB_LICENSE_SHA256` (ou `CT_UPDATE_LICENSE_SHA256`) e o SHA-256 do arquivo do Blob privado bater com
`CT_HUB_SHA256` e com o feed. Enquanto as variáveis não existirem, responde 503 e o Hub não instala nada.

Para ativar uma versão:
1. `node scripts/upload-creative-hub-release.mjs <instalador.exe> <versão>` com `CT_HUB_PRIVATE_BLOB_TOKEN`
   definido no terminal (o script confere SHA-256 e tamanho com o feed antes de enviar).
2. Na Vercel (Production): `CT_HUB_ENABLED=true`, `CT_HUB_VERSION`, `CT_HUB_PRIVATE_BLOB_PATH`, `CT_HUB_SHA256`
   e, se não reutilizar os do atualizador, `CT_HUB_PRIVATE_BLOB_TOKEN` e `CT_HUB_LICENSE_SHA256`.
3. Redeploy e teste no Hub: licença inválida → "licença recusada"; licença válida → instala.
