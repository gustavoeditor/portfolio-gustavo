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
