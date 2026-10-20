# Creative Tools · Publicação Windows e SmartScreen

## Diagnóstico verificado em 20/10/2026
O arquivo recuperado da biblioteca `Creative_Tools_Installer_v1.7_WINDOWS.exe` (SHA-256 `f6b4fa9184b0c479202074b06a5a335b9ba397ccdfa7c999343d773b58d47477`) é PE32+ x64, **sem Authenticode**: Data Directory `IMAGE_DIRECTORY_ENTRY_SECURITY` tem offset = 0 e size = 0. Por isso o Windows pode mostrar `Fornecedor desconhecido`.

O ZXP assinado para Adobe **não** autentica o instalador EXE do Windows.

## Critérios de saída para lançamento comercial
1. Obter assinatura Authenticode reconhecida pelo Windows, após **validação da identidade legal do editor**. Não falsificar emissor, não criar certificado autoassinado como solução comercial.
2. Assinar **cada build final** do instalador `.exe`, com timestamp de autoridade confiável. Modificar o EXE depois da assinatura invalida a prova.
3. Rodar `powershell -ExecutionPolicy Bypass -File scripts/verify-creative-tools-authenticode.ps1 -InstallerPath caminho\\Creative_Tools_Installer.exe -ExpectedPublisher "IDENTIDADE LEGAL VERIFICADA" -ReportPath comprovante.json`. Em distribuições automatizadas, executar com política confiável definida pelo administrador, sem exigir ao usuário alterar as proteções do Windows.
4. Instalar em uma máquina Windows limpa de teste, verificar o fabricante nos detalhes do executável, a cadeia de confiança e, separadamente, testar o SmartScreen com download HTTPS do domínio oficial.
5. Distribuir o mesmo EXE imutável e seu SHA-256 pelo site oficial. Não liberar links comerciais sem controle de licença.
6. Manter uma identidade de assinatura consistente entre versões para criar reputação. **A assinatura não garante o desaparecimento imediato do SmartScreen.**

## Certificação e custo (não iniciado)
- O serviço Microsoft Artifact Signing exige validação de identidade e atualmente restringe a emissão **Public Trust** a países específicos. Empresas ou pessoas físicas no Brasil não aparecem na lista de elegibilidade do Public Trust divulgada pela Microsoft. A disponibilidade de região Azure Brasil Sul **não** implica elegibilidade brasileira para um certificado público.
- Avaliar um certificado **OV de assinatura de código**, emitido por AC de confiança (e.g. DigiCert, Sectigo, GlobalSign) e token/HSM, observando requisitos de pessoa física ou jurídica aplicáveis.
- Não assumir compromisso de compra ou emissão sem aprovação expressa do titular.
- O Windows SmartScreen baseia-se em assinatura, identidade e reputação. Mesmo após um Authenticode válido, um aplicativo novo pode continuar pedindo confirmação até adquirir histórico positivo. Certificado EV não oferece bypass automático.
- Alternativa futura: redistribuição via Microsoft Store em formato MSIX, após avaliar compatibilidade da instalação CEP/UPIA.

## Referências
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- https://learn.microsoft.com/pt-br/windows/apps/package-and-deploy/code-signing-options
- https://learn.microsoft.com/pt-br/azure/artifact-signing/quickstart
