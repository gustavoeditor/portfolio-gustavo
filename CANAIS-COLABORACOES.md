# Canais e criadores atendidos

O portfólio exibe duas listas separadas com histórico real de colaboração.

- **atuais**: canais para os quais Gustavo trabalha atualmente.
- **anteriores**: canais para os quais Gustavo já realizou trabalhos, mas não há uma colaboração ativa.

O arquivo `canais.json` começa vazio para **não inventar colaborações**. Enquanto ambas as listas estiverem vazias, a seção `/#canais` fica oculta e não deixa espaço vazio na página.

## Como cadastrar

Edite `canais.json` com os canais informados e conferidos. Exemplo de formato (nomes fictícios somente para documentação; não são publicados):

```json
{
  "atuais": [
    {
      "nome": "Nome do canal atual",
      "url": "https://www.youtube.com/@canal-exemplo",
      "descricao": "Edição de vídeos para YouTube e shorts.",
      "imagem": "canais/canal-atual.webp"
    }
  ],
  "anteriores": [
    {
      "nome": "Nome do canal anterior",
      "url": "https://www.youtube.com/@outro-exemplo",
      "descricao": "Projeto de highlights e cinematics."
    }
  ]
}
```

- `nome`: obrigatório, nome público do canal.
- `url`: obrigatório, URL HTTPS que aponta ao canal (YouTube, Twitch ou outra página pública autêntica).
- `descricao`: opcional, tipo de colaboração real, sem métricas ou endosso inventados.
- `imagem`: opcional, logo com autorização de uso, salvo dentro da pasta `canais/` no repositório. São aceitos `.webp`, `.jpg`, `.jpeg`, `.png` ou `.svg`; mantenha arquivos pequenos e quadrados. Se não houver imagem, o cartão usa uma inicial elegante.

O site rejeita URLs inseguras, elimina entradas incompletas e só mostra a seção quando existe pelo menos um canal válido.

Não confunda **trabalhos autorais** com contratos de edição para um criador, e confira se o uso público do nome e logo da pessoa ou empresa está autorizado.
