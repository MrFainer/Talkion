# Documentação Técnica Do Talkion

## Resumo

Talkion é um backend em NestJS para ensino de inglês via WhatsApp. O sistema integra scraping de notícias, OpenAI, Evolution API e persistência em PostgreSQL para suportar:

- envio diário de notícias;
- quiz de interpretação;
- speaking por áudio;
- histórico de mensagens e interações.

## Escopo Implementado

Hoje o projeto cobre:

- notícias por nível;
- fallback por IA;
- quiz `3x3`;
- envio privado e envio em grupo;
- gabarito do quiz no ciclo seguinte;
- transcrição real com Whisper;
- feedback de speaking com OpenAI;
- associação por mensagem citada;
- persistência de quiz, áudio e feedback.

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

## Serviços Principais

### `NewsService`

Responsabilidades:

- buscar notícias no `newsinlevels.com`;
- extrair título, conteúdo, nível e URL;
- normalizar o conteúdo;
- salvar notícias;
- acionar fallback em IA quando necessário.

### `AiService`

Responsabilidades:

- gerar notícia de fallback;
- gerar quiz em JSON;
- transcrever áudio com `whisper-1`;
- avaliar speaking com `gpt-4o-mini`;
- devolver feedback estruturado.

Saída atual do speaking:

- `score`
- `feedback`
- `strengths`
- `improvements`
- `tips`
- `mistakes`
- `transcription`

### `QuizService`

Responsabilidades:

- criar quiz vinculado a uma notícia;
- reutilizar quiz existente para a mesma notícia;
- evitar custo desnecessário de OpenAI;
- persistir o quiz em `Quiz`.

### `WhatsappService`

Responsabilidades:

- gerenciar instância Evolution;
- registrar webhook;
- enviar mensagens;
- salvar mensagens enviadas e recebidas;
- distinguir fluxo privado e fluxo de grupo;
- processar respostas de quiz;
- processar áudios de speaking;
- resolver notícia e quiz por mensagem citada.

## Regras De Negócio

### Notícias

- são buscadas por nível do aluno quando possível;
- se não houver notícia por nível, o sistema usa a mais recente geral;
- se não houver notícia válida, o fallback por IA é acionado.

### Quiz

- sempre `3 perguntas`;
- sempre `3 alternativas`;
- aceita `A - ...`, `B - ...`, `C - ...`;
- formatos de resposta aceitos:
  - `A,B,C`
  - `A, B, C`
  - `1A,2B,3C`
  - `1A, 2B, 3C`

Persistência:

- `1` linha por aluno por quiz em `QuizAnswer`;
- `question_id = FULL_QUIZ`;
- `submitted_text` guarda o texto original;
- `correct_answer` guarda o gabarito normalizado;
- `is_correct = true` apenas com quiz inteiro correto;
- reenvio do mesmo aluno para o mesmo quiz é ignorado.

### Grupo

- o grupo não recebe correção imediata;
- o gabarito vai no ciclo seguinte;
- o fluxo diário atual é:

```txt
1. Good morning
2. Gabarito do quiz anterior
3. Introdução da notícia do dia
4. Notícia
5. Cabeçalho do quiz
6. Quiz
```

### Privado

- o privado é usado para speaking;
- o fluxo atual é:

```txt
1. Good morning
2. Introdução do desafio de speaking
3. Introdução da notícia do dia
4. Notícia
```

## Resolução Por Mensagem Citada

O `WhatsappService` usa `quoted_message_id` e `external_message_id` para resolver o contexto correto da resposta.

### Quiz

Ordem de resolução:

1. mensagem citada do quiz;
2. mensagem citada da notícia;
3. fallback para quiz mais recente.

### Áudio

Ordem de resolução:

1. mensagem citada da notícia;
2. notícia mais recente do nível do aluno;
3. notícia mais recente geral.

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

### Status E Conexão

- `GET /whatsapp/status`
- `GET /whatsapp/qrcode`
- `POST /whatsapp/webhook/register`
- `DELETE /whatsapp/logout`

### Mensageria

- `POST /whatsapp/test-send`
- `POST /whatsapp/send-latest-news-quiz`
- `POST /whatsapp/webhook`

### Endpoint De Envio Diário

Body mínimo:

```json
{
  "number": "5514991828055"
}
```

Body para teste forçado:

```json
{
  "number": "5514991828055",
  "mode": "GROUP"
}
```

`mode` aceito:

- `PRIVATE`
- `GROUP`

Sem `mode`, a detecção ocorre pelo destino.

## Variáveis De Ambiente Relevantes

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

- `BACKEND_URL` define o webhook público/visível para a Evolution;
- `ALLOW_SELF_WHATSAPP_TEST` permite testar quiz e áudio enviados pelo próprio número;
- antes de produção, essa flag deve ser desligada.

## Logs

Padrão de logs atual:

- `[ENTRADA]`
- `[STATUS]`
- `[QUIZ]`
- `[QUIZ][RESOLUCAO]`
- `[AUDIO][SAIDA]`
- `[DB][ERRO]`

Esses logs foram desenhados para mostrar rapidamente:

- quem enviou;
- tipo da mensagem;
- se houve citação;
- como o quiz foi resolvido;
- qual notícia foi usada;
- o que foi salvo ou ignorado.

## Observações Técnicas

- o título da notícia enviado no WhatsApp remove o sufixo de `level`;
- o destaque de `Difficult Words` aparece no corpo da notícia e na seção final;
- o feedback de speaking é enviado em português brasileiro;
- palavras problemáticas permanecem em inglês quando isso melhora o valor pedagógico;
- o backend já registra `remote_jid`, `related_news_id` e `related_quiz_id` para rastreabilidade.

## Pendências Naturais Do Projeto

- agendamento automático do ciclo diário;
- cadastro operacional de grupos reais;
- dashboards de acompanhamento;
- ranking e analytics de engajamento;
- relatórios pedagógicos por aluno;
- refinamento visual dos templates de WhatsApp.
