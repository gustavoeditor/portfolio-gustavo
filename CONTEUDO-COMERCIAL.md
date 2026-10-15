# Conteúdo comercial do portfólio

Esta atualização coloca os estudos de caso, as ofertas, o processo de contratação, as perguntas frequentes e o formulário de orçamento no site público. Os 17 projetos e o painel privado continuam funcionando.

## Estudos de caso

Os três primeiros exemplos usam somente os projetos já publicados:
- AWP The Prince: montagem, trocas de cenário, ritmo e sound design.
- Butterfly Gamma Doppler: iluminação dramática, enquadramentos próximos e foco no produto.
- KeyDrop AWP Cinematic: composição 3D, ambiente escuro e luz.

Não há métricas inventadas, afirmações de aumento de vendas nem atribuições não verificadas a clientes.

## Como ativar depoimentos reais

O arquivo `depoimentos.json` começa como `[]`. Assim a seção pública permanece oculta até existir conteúdo com autorização.

Depois de obter autorização da pessoa, inclua um objeto por depoimento:

```json
[
  {
    "name": "Nome autorizado da pessoa",
    "role": "Cargo ou canal, se autorizado",
    "quote": "Comentário real aprovado pela própria pessoa, sem alterações de sentido.",
    "link": "https://site-que-comprove-o-trabalho.example"
  }
]
```

O campo `link` é opcional. Não publique informações privadas, cargos inventados, nomes de empresas sem autorização ou resultados que não possa comprovar. O site exibe automaticamente a seção quando existirem depoimentos válidos.

## Como ativar comparações antes/depois

É necessário ter **duas imagens do mesmo take**: uma do material bruto real e outra do resultado final. A comparação nunca deve ser fabricada.

1. Exporte dois frames iguais em PNG, JPG ou WebP (preferencialmente 960 × 540 px, abaixo de 200 KB).
2. Adicione os arquivos à pasta `comparacoes/`.
3. Atualize `comparacoes.json`:

```json
[
  {
    "title": "Nome do take",
    "original": "comparacoes/take-original.webp",
    "final": "comparacoes/take-final.webp",
    "description": "Explicação concisa do trabalho de edição realizado."
  }
]
```

Quando houver ao menos um par válido, o site libera o comparador arrastável. Com listas vazias, as seções ficam ocultas sem espaços sobrando.

## Formulário de orçamento

O formulário em `/#orcamento` funciona inteiramente no navegador. Não coleta dados em banco. O visitante informa o briefing e decide se envia a mensagem preenchida pelo WhatsApp. O site **não recebe** nem armazena essas informações.

Não há tabela de preços fixa nem prazo garantido: ambos são combinados conforme o projeto. Os botões de cada serviço já selecionam a categoria correspondente.

## Analytics

Foi incluída a instrumentação leve do **Vercel Web Analytics**, com visualizações de página e eventos de interesse em serviços, reprodução de vídeo e início de contato.

É necessário acessar a Vercel → `portfolio-gustavo` → **Analytics** e habilitar **Web Analytics** caso ainda esteja desligado. Eventos personalizados podem exigir plano Vercel Pro ou Enterprise.

Somente nomes genéricos de evento e de categoria são enviados aos eventos. **O conteúdo do briefing, o nome da pessoa e o link de referência não são registrados nas métricas**. Confira requisitos regulatórios de privacidade aplicáveis à operação do site.

## Compartilhamento e SEO

Os metadados Open Graph e Twitter Card apontam para `/api/social-image`, que cria uma arte PNG de 1200 × 630 px com a identidade visual do portfólio, usando processamento no servidor.

Atualizações de pré-visualização do WhatsApp, de busca e de redes sociais dependem de cache e dos robôs de cada plataforma. A publicação não garante posição no Google nem aumento automático de clientes.
