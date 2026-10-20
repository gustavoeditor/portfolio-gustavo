# Creative Tools Updater v1.0 · Distribuição oficial

O aplicativo Windows consulta exclusivamente `https://portfolio-gustavo-chi.vercel.app/updates/creative-tools/manifest.json`. Ele aceita somente versões `status: "published"` que coincidam com `latest` e tenham SHA-256 de 64 dígitos; baixa `GET /api/creative-tools-update?version=<versao>` com `Authorization: Bearer <chave_cliente>`.

O servidor, reaproveitando a função `api/managed-projects.js` para permanecer compatível com o limite da Vercel Hobby, rejeita qualquer release não aprovado no catálogo, versão/hash divergente, licença inválida e blob com SHA-256 incorreto. O ZXP é entregue a partir de Vercel Blob privado, nunca como arquivo público estático.

## Estado atual

- A Alpha 1.4.24 continua `preview` e `latest: null`. **Não é possível disparar download automático hoje**, por escolha de segurança.
- As variáveis `CT_UPDATE_*` não estavam configuradas em produção na auditoria inicial do app. O endpoint protegido permanece indisponível até ativação.
- O updater para Windows compila e passa nos testes automatizados, mas **não** foi executado em um PC Windows real com After Effects e Adobe Creative Cloud.
- O executável do updater permanece sem assinatura Authenticode. Não anunciá-lo como release comercial definitivo até adquirir certificado verificável.
- O sistema de chaves da Cakto ainda não está integrado ao licenciamento do Updater. As chaves devem ser geradas e vinculadas a compras confirmadas, com revogação e suporte.

## Procedimento para publicar uma próxima versão para clientes

1. **Testar** o ZXP final no Adobe After Effects e confirmar que Adobe UPIA instala/substitui corretamente o pacote e que as ferramentas operam em situações reais. Manter a Alpha aprovada e o histórico intactos.
2. **Validar** o manifest interno: Bundle ID `com.gustavo.trio`, host `AEFT`, `ExtensionBundleVersion` igual à versão da publicação e assinatura ZXP Adobe criptograficamente válida. Arquivos de desenvolvimento não devem ser promovidos.
3. Fazer **upload privado** de `Creative_Tools_<versao>.zxp` no Blob Store com caminho `creative-tools/releases/Creative_Tools_<versao>.zxp`. Nunca colocar o ZXP dentro da pasta pública do site nem em release público do GitHub.
4. Configurar no projeto Vercel **production**, com segredos reais armazenados em Environment Variables (nunca dentro de git):
   - `CT_UPDATE_ENABLED=true`
   - `CT_UPDATE_VERSION=<versao>`
   - `CT_UPDATE_PRIVATE_BLOB_PATH=creative-tools/releases/Creative_Tools_<versao>.zxp`
   - `CT_UPDATE_PRIVATE_BLOB_TOKEN=<token do Blob privado>`
   - `CT_UPDATE_SHA256=<SHA256 exato do ZXP>`
   - `CT_UPDATE_LICENSE_SHA256=<hash SHA-256 de cada chave individual, separado por vírgulas>`.
5. Antes de alterar `latest`, chamar o endpoint com licença **inválida** e confirmar HTTP 403 (com a versão aprovada em ambiente de prévia); depois usar uma licença teste válida e conferir o SHA-256 do pacote. Não colocar a licença em query string nem em logs.
6. Atualizar `updates/creative-tools/manifest.json`: definir a entrada aprovada `status: "published"` e `latest` igual à versão, mantendo hash idêntico ao token de storage. Fazer PR, passar testes e publicar Vercel. **Só depois** permitir ao aplicativo atualizar.
7. Um computador Windows com updater ativado buscará novas versões a cada hora via Agendador de Tarefas. Se After Effects estiver aberto, apenas adia; não encerra a sessão. Se não houver licença válida, não baixa nem instala.
8. Para **revogar** uma release problemática, remover `latest` (colocar `null`), retornar `status` para `preview` e desativar `CT_UPDATE_ENABLED`. Para revogar clientes, remover hash de `CT_UPDATE_LICENSE_SHA256`.

## Segurança e operação

- O Windows aplica **DPAPI** à chave de acesso local em `%LOCALAPPDATA%\\CreativeTools\\Updater\\settings.json` e a instalação usa `UnifiedPluginInstallerAgent.exe /install` com limite de quatro minutos, sem executar arquivos `.exe` baixados.
- Nunca desabilitar SmartScreen, UAC ou verificações Adobe. A presença de `META-INF/signatures.xml` não substitui a validação criptográfica feita pelo Adobe UPIA.
- O modo automático só é ativado com o clique do usuário em **AUTOMÁTICO: ON**; tarefas horárias podem ser removidas por **AUTOMÁTICO: OFF**.
- A verificação e a publicação continuam protegidas por HTTPS, hash e verificação de licença; **nenhum pagamento ou hospedagem nova foi contratado pelo processo de desenvolvimento**.
- Logs: `%LOCALAPPDATA%\\CreativeTools\\Updater\\updater.log`.

## Diagnóstico de teste

Rejeitar obrigatoriamente: status `preview`, `latest: null`, download com redirecionamento HTTPS para outro domínio, SHA divergente, ZXP adulterado, arquivo acima de 25 MiB, licença inválida e After Effects aberto.
