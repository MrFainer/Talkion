# Documentacao Tecnica Do Talkion

## Resumo

Talkion e um backend em NestJS para ensino de ingles via WhatsApp. O sistema integra scraping de noticias, OpenAI, Evolution API e persistencia em PostgreSQL para suportar:

- envio diario de noticias;
- quiz de interpretacao;
- speaking por audio;
- historico de mensagens e interacoes.

## Escopo Implementado

Hoje o projeto cobre:

- noticias por nivel;
- fallback por IA;
- quiz `3x3`;
- envio privado e envio em grupo;
- gabarito do quiz no ciclo seguinte;
- transcricao real com Whisper;
- feedback de speaking com OpenAI;
- associacao por mensagem citada;
- persistencia de quiz, audio e feedback.

## Arquitetura Atual

```txt
[News in Levels] ---> [NewsService] ---> [PostgreSQL]
                          |
                          v
                      [QuizService] ---> [OpenAI]
                          |
                          v
[Evolution API] <--> [WhatsappService] <--> [AIService]
                          |
                          v
                     [Webhook Handler]
```

## Servicos Principais

### `NewsService`

Responsabilidades:

- buscar noticias no `newsinlevels.com`;
- extrair titulo, conteudo, nivel e URL;
- normalizar o conteudo;
- salvar noticias;
- acionar fallback em IA quando necessario.

### `AiService`

Responsabilidades:

- gerar noticia de fallback;
- gerar quiz em JSON;
- transcrever audio com `whisper-1`;
- avaliar speaking com `gpt-4o-mini`;
- devolver feedback estruturado.

Saida atual do speaking:

- `score`
- `feedback`
- `strengths`
- `improvements`
- `tips`
- `mistakes`
- `transcription`

### `QuizService`

Responsabilidades:

- criar quiz vinculado a uma noticia;
- reutilizar quiz existente para a mesma noticia;
- evitar custo desnecessario de OpenAI;
- persistir o quiz em `Quiz`.

### `WhatsappService`

Responsabilidades:

- gerenciar instancia Evolution;
- registrar webhook;
- enviar mensagens;
- salvar mensagens enviadas e recebidas;
- distinguir fluxo privado e fluxo de grupo;
- processar respostas de quiz;
- processar audios de speaking;
- resolver noticia e quiz por mensagem citada.

## Regras De Negocio

### Noticias

- sao buscadas por nivel do aluno quando possivel;
- se nao houver noticia por nivel, o sistema usa a mais recente geral;
- se nao houver noticia valida, o fallback por IA e acionado.

### Quiz

- sempre `3 perguntas`;
- sempre `3 alternativas`;
- aceita `A - ...`, `B - ...`, `C - ...`;
- formatos de resposta aceitos:
  - `A,B,C`
  - `A, B, C`
  - `1A,2B,3C`
  - `1A, 2B, 3C`

Persistencia:

- `1` linha por aluno por quiz em `QuizAnswer`;
- `question_id = FULL_QUIZ`;
- `submitted_text` guarda o texto original;
- `correct_answer` guarda o gabarito normalizado;
- `is_correct = true` apenas com quiz inteiro correto;
- reenvio do mesmo aluno para o mesmo quiz e ignorado.

### Grupo

- o grupo nao recebe correcao imediata;
- o gabarito vai no ciclo seguinte;
- o fluxo diario atual e:

```txt
1. Good morning
2. Gabarito do quiz anterior
3. Introducao da noticia do dia
4. Noticia
5. Cabecalho do quiz
6. Quiz
```

### Privado

- o privado e usado para speaking;
- o fluxo atual e:

```txt
1. Good morning
2. Introducao do desafio de speaking
3. Introducao da noticia do dia
4. Noticia
```

## Resolucao Por Mensagem Citada

O `WhatsappService` usa `quoted_message_id` e `external_message_id` para resolver o contexto correto da resposta.

### Quiz

Ordem de resolucao:

1. mensagem citada do quiz;
2. mensagem citada da noticia;
3. fallback para quiz mais recente.

### Audio

Ordem de resolucao:

1. mensagem citada da noticia;
2. noticia mais recente do nivel do aluno;
3. noticia mais recente geral.

## Modelos Principais

### `News`

```txt
id
title
content
level
source_type
source_url
created_at
```

### `Quiz`

```txt
id
news_id
questions (JSON)
created_at
```

### `QuizAnswer`

```txt
id
student_id
quiz_id
question_id
selected_answer
submitted_text
correct_answer
is_correct
created_at
```

### `WhatsappMessage`

```txt
id
student_id
message_type
direction
content
media_url
remote_jid
external_message_id
quoted_message_id
related_news_id
related_quiz_id
content_kind
created_at
```

### `AudioSubmission`

```txt
id
student_id
news_id
audio_url
transcription
created_at
```

### `SpeakingFeedback`

```txt
id
audio_submission_id
score
feedback
mistakes
created_at
```

## Endpoints Operacionais

### Status E Conexao

- `GET /whatsapp/status`
- `GET /whatsapp/qrcode`
- `POST /whatsapp/webhook/register`
- `DELETE /whatsapp/logout`

### Mensageria

- `POST /whatsapp/test-send`
- `POST /whatsapp/send-latest-news-quiz`
- `POST /whatsapp/webhook`

### Endpoint De Envio Diario

Body minimo:

```json
{
  "number": "5514991828055"
}
```

Body para teste forcado:

```json
{
  "number": "5514991828055",
  "mode": "GROUP"
}
```

`mode` aceito:

- `PRIVATE`
- `GROUP`

Sem `mode`, a deteccao ocorre pelo destino.

## Variaveis De Ambiente Relevantes

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
BACKEND_URL="http://host.docker.internal:3001"
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="global_api_key_talkion"
EVOLUTION_INSTANCE_NAME="talkion_main"
ALLOW_SELF_WHATSAPP_TEST="true"
```

Notas:

- `BACKEND_URL` define o webhook publico/visivel para a Evolution;
- `ALLOW_SELF_WHATSAPP_TEST` permite testar quiz e audio enviados pelo proprio numero;
- antes de producao, essa flag deve ser desligada.

## Logs

Padrao de logs atual:

- `[ENTRADA]`
- `[STATUS]`
- `[QUIZ]`
- `[QUIZ][RESOLUCAO]`
- `[AUDIO][SAIDA]`
- `[DB][ERRO]`

Esses logs foram desenhados para mostrar rapidamente:

- quem enviou;
- tipo da mensagem;
- se houve citacao;
- como o quiz foi resolvido;
- qual noticia foi usada;
- o que foi salvo ou ignorado.

## Observacoes Tecnicas

- o titulo da noticia enviado no WhatsApp remove o sufixo de `level`;
- o destaque de `Difficult Words` aparece no corpo da noticia e na secao final;
- o feedback de speaking e enviado em portugues brasileiro;
- palavras problemáticas permanecem em ingles quando isso melhora o valor pedagogico;
- o backend ja registra `remote_jid`, `related_news_id` e `related_quiz_id` para rastreabilidade.

## Pendencias Naturais Do Projeto

- agendamento automatico do ciclo diario;
- cadastro operacional de grupos reais;
- dashboards de acompanhamento;
- ranking e analytics de engajamento;
- relatórios pedagogicos por aluno;
- refinamento visual dos templates de WhatsApp.
