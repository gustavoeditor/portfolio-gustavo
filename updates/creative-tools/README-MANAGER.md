# Creative Tools Manager v2.0 Beta · Windows

**Estado:** aplicativo Windows x64 compilado para homologação interna, não comercializado nem publicado como download público.

## Funções entregues

- **Instalar / Reparar**: pacote Creative Tools Alpha 1.4.24 de desenvolvimento incorporado ao EXE, SHA-256 `d7869da1b209eb3fc2bef3167d480ef886ea977922cb063e6ad6b524f364c877`, verificado contra o manifesto Adobe (`com.gustavo.trio`, `AEFT`) e encaminhado ao Adobe UnifiedPluginInstallerAgent (`/install`). Não solicita licença para essa operação e bloqueia downgrade por acidente.
- **Verificar / Atualizar**: usa exclusivamente `https://portfolio-gustavo-chi.vercel.app/updates/creative-tools/manifest.json`; consulta versões, instala releases `published` mais recentes pelo endpoint protegido `/api/creative-tools-update`, valida o SHA-256 antes de solicitar `UPIA /install`. Nunca baixa ou executa outro EXE.
- **Desinstalar**: solicita confirmação, identifica o produto em `UPIA /list all` e usa `/remove Creative Tools` (ou ID Creative Tools explicitamente identificado). Não remove plugins de terceiros, arquivos do After Effects nem pastas CEP arbitrariamente.
- **Gerenciar licença**: chave opcional e protegida por DPAPI para baixar novas versões privadas; instalar/reparar/desinstalar a versão incorporada é independente dessa chave.
- **Auto (Janela)**: consulta de hora em hora somente com o aplicativo aberto. Não cria serviço, tarefa agendada, autoinicialização nem se copia para AppData.
- **Compatibilidade**: instalação, remoção e atualização aguardam o fechamento do After Effects; o Adobe UPIA executa em goroutine com limite de quatro minutos. Interface Win32 mantém `runtime.LockOSThread()` para evitar a regressão de congelamento.
- **Diagnóstico**: `%LOCALAPPDATA%\\CreativeTools\\Updater\\updater.log`.

## Estado real do lançamento automático

A Alpha 1.4.24 está marcada como `preview` e o campo `latest` do catálogo é `null`. Por isso **não há atualizações remotas instaláveis hoje**. A distribuição privada via Vercel Blob e as licenças dos compradores Cakto ainda não estão ativadas. Não promover a Alpha automaticamente para release ou fornecer ZXP por link público antes da validação.

## QA antes do lançamento comercial

- Build Go 1.23 cross-compiled para Windows amd64 e testado com `go test -race`, `GOOS=windows GOARCH=amd64 go vet`. Os testes cobrem hash do pacote incorporado, versão Adobe, bloqueio de downgrade, escolha restrita do plugin a remover, HTTPS, feed `published`, licença, limite de download e regressão da GUI.
- **Não foi testado no Windows real com Adobe UPIA, After Effects 2026 ou Defender.**
- O EXE ainda não possui assinatura Authenticode de editor reconhecido; o ZXP incorporado foi assinado com certificado de desenvolvimento. Falhas de assinatura devem ser exibidas, nunca burladas.
- Testar instalar e reparar, depois remover (com confirmação), consultar o site com `latest=null` e testar o modo AUTO (JANELA). Para o fluxo remoto, habilitar uma release homologada num ambiente controlado e testar licença válida/inválida e SHA divergente.
- Nenhuma despesa ou serviço de terceiros adicional foi contratado.

## Distribuição

A versão Beta é entregue privadamente no ChatGPT como `Creative_Tools_Manager_v2.0_WINDOWS_BETA.exe` e pacote ZIP de testes. O repositório público armazena somente este documento; **não** hospeda o EXE nem o pacote de desenvolvimento ZXP.
