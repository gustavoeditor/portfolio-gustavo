# GUSTAVO® SENTINEL — Runbook

## Estado

- **Ativo sem configuração extra:** testes de disponibilidade de produção via GitHub Actions a cada 30 minutos (agendamentos do GitHub podem atrasar ou ser desativados após inatividade). Três tentativas por alvo; incidentes em GitHub Issues, sem duplicação e encerramento automático quando recuperados. A automação não publica código.
- **Ativo no painel:** /sentinel e /admin/sentinel, protegidos pela sessão existente de /admin. Verificações ao vivo dos recursos principais.
- **Ativo no navegador:** identifica sinais técnicos sem capturar conteúdo digitado, identidade, IP ou URLs. Os fallbacks existentes de capas e vídeos continuam operando localmente.
- **Pendente de infraestrutura:** salvar eventos de visitantes na Vercel Blob requer também UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN. A coleta é desabilitada por padrão caso o limitador distribuído não esteja configurado.

## Preparar eventos reais

1. Conectar um armazenamento Redis/Upstash compatível ao projeto Vercel, usando variáveis **somente no servidor**: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN. Não inserir esses valores no HTML ou GitHub.
2. Confirmar que o Vercel Blob está conectado (BLOB_STORE_ID / BLOB_WEBHOOK_PUBLIC_KEY via OIDC ou BLOB_READ_WRITE_TOKEN).
3. Implantar as alterações de variáveis e verificar o painel /sentinel. Se o endpoint /api/sentinel-status informar telemetryEnabled=true, a coleta fica habilitada.
4. Limites: até 18 eventos por origem de rede/hora e 1500 eventos/dia globais. O cliente limita a 12 sinais por carregamento, com intervalos mínimos por categoria.
5. Somente categorias e componentes predefinidos são aceitos. Dados livres (incluindo textos, links, endereço IP, formulários e pilhas de erros) nunca são enviados ao armazenamento. Os agregados diários podem ser consultados apenas via sessão administrativa, apesar do acesso público aos blobs exigido pelo SDK utilizado.
6. Eventos são *sinais*, não confirmação de defeito. Verificar antes de modificar o código.

## Monitoramento agendado

- Workflow: .github/workflows/sentinel.yml
- Diagnóstico: scripts/sentinel-check.cjs
- 2 vezes por hora (GitHub Actions não garante execução na hora exata).
- Alertas: issue privada/pública conforme visibilidade do repositório, título fixo \`[SENTINEL] Problema no portfólio público\`, contendo apenas verificações de recursos estáticos.
- As notificações dependem das configurações do GitHub do proprietário. Confirmar que GitHub Actions está habilitado e que o workflow possui permissão de escrita para Issues.
- Quando as verificações voltam a funcionar, o workflow fecha o mesmo issue automaticamente. Ele nunca faz rollback ou deploy por conta própria.

## Recuperações automáticas permitidas

- Trocar origem de capa quando recurso falhar, ou exibir fallback visual integrado.
- Tentativas alternativas de origem de vídeo previamente autorizadas.
- Não reiniciar sessão de usuário nem redefinir preferências.
- Nunca usar relatos anônimos para alterar código, rodar comandos ou criar releases sem testes/validação.

## Segurança e privacidade

A área /sentinel usa a autenticação existente. Não gravar dados de clientes e nem abrir logs com dados pessoais. O sistema não inclui gravador de sessão, captura de tela, rastreamento de cliques individuais, endereço IP, query strings, cookies ou conteúdo do WhatsApp.

O monitor de disponibilidade verifica respostas HTTP e marcadores no HTML/JS; não garante a inexistência de erros visuais. O checklist de manutenção deve complementar com testes manuais de desktop, mobile, vídeo, upload e orçamento.

## Gráficos de visitas, cliques e interações

- A central exibe contagem agregada dos últimos 7 dias: sessões, cliques em Pack de edição/Orçamento/Vídeos/Trabalhos/Áudio/Navegação, e reproduções iniciadas.
- Uma sessão é estimada por aba via sessionStorage. **Não é número de pessoas únicas.** Exibição dos gráficos depende de Redis e Blob; os cartões mostram indisponibilidade em vez de valores simulados quando desabilitado.
- Respeita Global Privacy Control e Do Not Track. Os campos digitados nunca são medidos e o formulário não registra o conteúdo do briefing.
- A página pública /privacidade.html explica a coleta e pode ser acessada no rodapé.
- Vercel Web Analytics não está habilitado no projeto atualmente; o SENTINEL coleta suas próprias métricas agregadas quando a infraestrutura de limitação estiver disponível.

## Implantação segura sem Redis

A página pública consulta `GET /api/sentinel-event` antes de enviar eventos. Quando Redis ou Blob não estão disponíveis, essa rota retorna apenas `{\"enabled\":false}`, e o navegador interrompe a telemetria sem enviar POSTs adicionais. A central exibe dados indisponíveis em vez de contagens inventadas.
