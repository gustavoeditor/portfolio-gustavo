# Creative Hub · distribuição privada do Creative Tools

**Estado: beta privada para testes.** O instalador do Creative Tools 1.5.1 (artefato do PR #7 do
repositório `creative-tools`, SHA-256 `41a3aca985cc6dd5eb2fcc8737f9a7a05adda0af288441f3529e9c94431b14ca`,
5.742.091 bytes) é entregue **somente** pelo endpoint protegido abaixo. Nenhum binário entra neste
repositório (que é público) nem em pastas estáticas do site.

## Peças

| Arquivo | Função |
|---|---|
| `creative-hub/catalog.json` | Catálogo lido pelo Creative Hub (≥ 0.1.1). Creative Tools com `access: "license"`. |
| `updates/creative-tools/hub-manifest.json` | Feed exclusivo do Hub (o `manifest.json` do Updater v1.x não muda). |
| `lib/creative-hub-delivery.js` | `GET /api/creative-hub/download?product=creative-tools&version=1.5.1` |
| `scripts/upload-creative-hub-package.mjs` | Envia o `.exe` aprovado ao Blob privado, após conferir hash e tamanho. |

O endpoint exige `Authorization: Bearer <licença>` (hash SHA-256 comparado em tempo constante),
versão `published` no feed com o mesmo SHA-256/tamanho, e confere o SHA-256 do blob inteiro antes
de liberar cada parte. Entrega em partes de 3 MiB (`Range`), porque Vercel Functions limitam a
resposta a ~4,5 MB. Sem configuração, responde 503; sem licença válida, 403 sem tocar no storage.

## Ativar a beta privada (passos do proprietário)

1. Criar (ou reutilizar) um **Blob Store privado** na Vercel e copiar o token de leitura/escrita.
2. Baixar o artefato aprovado do PR #7 e enviar:
   ```powershell
   $env:CT_HUB_PRIVATE_BLOB_TOKEN = "<token>"
   node scripts/upload-creative-hub-package.mjs .\Creative_Tools_BETA_PREMIUM_MENU_WINDOWS.exe
   ```
3. Gerar uma ou mais **chaves de teste** (20–128 caracteres `A-Z a-z 0-9 _ -`) e calcular o SHA-256 de cada uma:
   ```powershell
   $k = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_}); $k
   [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($k))).Replace('-','').ToLower()
   ```
   Guarde a chave; na Vercel vai somente o hash.
4. Em **Settings → Environment Variables**, somente no ambiente **Preview** (ou só para a branch
   `feature/creative-hub-licensed-installer`): `CT_HUB_ENABLED`, `CT_HUB_VERSION`,
   `CT_HUB_PRIVATE_BLOB_PATH`, `CT_HUB_SHA256`, `CT_HUB_SIZE`, `CT_HUB_PRIVATE_BLOB_TOKEN` (Sensitive),
   `CT_HUB_LICENSE_SHA256`. Fazer redeploy da prévia.
5. Testar no Creative Hub 0.1.1: Configurações → Licença → colar a chave de teste. Para apontar o Hub à
   prévia: `$env:CREATIVE_HUB_CATALOG_URL = "https://<url-da-previa>/creative-hub/catalog.json"` antes de abrir.
   Se a prévia tiver *Deployment Protection*, use um link de bypass ou desative a proteção apenas
   para esta prévia.
6. **Produção** somente após aprovação: merge do PR + as mesmas variáveis no ambiente Production.

## Revogar

Remover o hash da chave de `CT_HUB_LICENSE_SHA256`, ou `CT_HUB_ENABLED=false`, ou `latest: null` no feed.

## Licenças de clientes (Cakto)

Implementado: a compra na Cakto chega pelo webhook, o cliente entra em `/conta` com o e-mail da
compra e gera a chave do Hub. O endpoint confere a chave no Supabase (só o hash é guardado) e também
aceita a sessão do site para o download direto. Reembolso/chargeback desativa a chave.
`CT_HUB_LICENSE_SHA256` continua valendo para chaves de **teste**. Configuração: `CONTAS-E-CAKTO.md`.
