# Canais e criadores atendidos

O portfólio exibe duas listas separadas com histórico real de colaboração.

- **atuais**: canais para os quais Gustavo trabalha atualmente.
- **anteriores**: canais para os quais Gustavo já realizou trabalhos, mas não há uma colaboração ativa.

Os canais são cadastrados no arquivo `canais.json`. Enquanto ambas as listas estiverem vazias, a seção `/#canais` fica oculta e não deixa espaço vazio na página.

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
- `imagem`: opcional, foto de reserva salva dentro de `canais/`. São aceitos `.webp`, `.jpg`, `.jpeg`, `.png` ou `.svg`; mantenha arquivos pequenos e quadrados.

## Foto automática do YouTube

Ao cadastrar um canal do YouTube, basta preencher o link do canal: a foto pública é buscada automaticamente. Não é necessário cadastrar a imagem nem configurar chave de API. São aceitos links `https://www.youtube.com/@nome`, `/channel/UC...`, `/c/nome` e `/user/nome`.

Mover um canal entre `atuais` e `anteriores` mantém a foto automática. A busca é atualizada periodicamente, com cache de até seis horas no servidor e uma hora no navegador; em caso de indisponibilidade, uma resposta anterior pode continuar em uso por até sete dias. Uma mudança de foto no YouTube pode levar esse período para aparecer.

Se a busca falhar, o cartão usa `imagem`, quando cadastrada, e depois a inicial do canal. SkinsMonkey e O Alex CS já têm cópias locais das fotos como reserva. Outros serviços continuam usando a imagem manual ou a inicial.

A rota `/api/channel-avatar` aceita somente canais presentes no cadastro, busca apenas páginas do YouTube e só redireciona para os servidores de imagem permitidos do YouTube. O cadastro do canal em si continua sendo feito no `canais.json`; esta alteração automatiza a foto.

O site rejeita URLs inseguras, elimina entradas incompletas e só mostra a seção quando existe pelo menos um canal válido.

Não confunda **trabalhos autorais** com contratos de edição para um criador, e confira se o uso público do nome e logo da pessoa ou empresa está autorizado.
