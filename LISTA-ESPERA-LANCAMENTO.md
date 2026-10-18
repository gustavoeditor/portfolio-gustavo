# Lista de interesse: lançamento Creative Tools e IA Premiere

## Objetivo
Converter visitantes vindos dos tutoriais do YouTube em inscritos que autorizem receber novidades sobre os produtos, sem antecipar vendas nem prometer datas.

## Experiência planejada
- Bloco discreto na loja com chamada "Receba o aviso de lançamento", benefícios concretos e campo de e-mail.
- Página de confirmação com instruções para verificar a caixa de entrada.
- Identificar campanha por parâmetros UTM sem coletar dados desnecessários.
- Separar preferências: Creative Tools para After Effects e IA de edição para Premiere.
- Consentimento explícito, política de privacidade acessível e cancelamento simples.
- Acessibilidade: rótulos, mensagens de erro, teclado e feedback de envio.

## Backend e segurança
- Persistência durável em provedor de e-mail marketing ou banco, nunca em arquivo local de função serverless.
- Evitar publicar endereços em GitHub, logs ou frontend.
- Validar e normalizar e-mails no servidor, impor limites de requisições, proteção contra bots e duplicidade.
- Enviar confirmação de inscrição e oferecer descadastro; registrar consentimento com data e versão do aviso.
- Verificar requisitos da LGPD e configuração de envio antes de ativar a coleta.
- Segredos exclusivamente em variáveis de ambiente da Vercel.

## Integração com conteúdo
- Links da descrição do YouTube com UTM para medir origens.
- Página de espera focada em demonstrações reais e expectativa honesta.
- Medir visitas, envios bem-sucedidos e taxa de inscrição, sem rastreamento invasivo.

## Etapas
1. Escolher provedor de armazenamento e envio e configurar segredos.
2. Implementar endpoint seguro, validação e testes automatizados.
3. Adicionar formulário à loja e atualizar privacidade.
4. Testar inscrição, duplicidade, erro de rede, descadastro e responsividade.
5. Publicar e verificar o deploy na Vercel.

**Estado:** especificação inicial. Nenhuma coleta de e-mails foi ativada por este documento.
