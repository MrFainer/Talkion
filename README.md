# Talkion

Talkion e uma plataforma de aprendizado de ingles via WhatsApp que transforma noticias reais em uma rotina diaria de estudo com leitura, quiz e speaking com IA.

## Proposta

Em vez de obrigar o aluno a abrir uma plataforma toda vez que quiser estudar, o Talkion leva o conteudo para o canal onde ele ja esta: o WhatsApp.

O sistema usa noticias em ingles como base para uma experiencia continua de aprendizagem:

- leitura com conteudo real;
- quiz curto e objetivo;
- speaking com envio de audio;
- feedback automatico com IA;
- historico de interacoes para evolucao futura.

## Destaques

- noticias diarias por nivel com scraping do `newsinlevels.com`;
- fallback por IA quando o scraping falha;
- quiz automatico com `3 perguntas` e `3 alternativas`;
- speaking com transcricao real usando `whisper-1`;
- feedback pedagogico com `gpt-4o-mini`;
- envio separado para `privado` e `grupo`;
- gabarito do quiz enviado no ciclo seguinte;
- resolucao por mensagem citada no WhatsApp;
- persistencia de respostas, audios e feedbacks.

## Como O Produto Funciona

### Fluxo Privado

Usado para o aluno praticar speaking:

1. envio de `Good morning` com o dia da semana;
2. introducao do desafio de speaking;
3. bloco de transicao para a noticia do dia;
4. envio da noticia;
5. aluno responde com audio;
6. sistema avalia e devolve feedback.

### Fluxo Grupo

Usado para leitura e participacao coletiva:

1. envio de `Good morning` com o dia da semana;
2. gabarito do quiz anterior, quando existir;
3. bloco de transicao para a noticia do dia;
4. envio da noticia;
5. cabecalho do quiz;
6. envio do quiz;
7. alunos respondem no grupo.

## Diferenciais Do Fluxo

- o quiz nao responde imediatamente no grupo;
- o gabarito aparece no proximo ciclo diario;
- o aluno pode responder usando mensagem citada;
- o audio pode ser associado automaticamente a noticia correta;
- o quiz pode ser associado automaticamente ao envio correto;
- o sistema evita gerar quiz repetido para a mesma noticia.

## Regras De Negocio Atuais

- quiz com exatamente `3 perguntas` e `3 alternativas`;
- formatos aceitos: `A,B,C`, `A, B, C`, `1A,2B,3C`, `1A, 2B, 3C`;
- uma linha em `QuizAnswer` por aluno por quiz;
- `is_correct` so fica `true` quando o quiz inteiro esta correto;
- reenvios do mesmo quiz pelo mesmo aluno sao ignorados;
- speaking usa mensagem citada ou fallback para a noticia mais recente do nivel.

## Stack

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Axios
- Cheerio

### IA

- OpenAI `gpt-4o-mini`
- OpenAI `whisper-1`

### Infraestrutura E Integracoes

- Evolution API
- Docker
- Docker Compose
- Redis

## Estrutura Do Projeto

- `backend/src/news`: scraping, limpeza e persistencia das noticias
- `backend/src/ai`: fallback de noticia, geracao de quiz e feedback de speaking
- `backend/src/quiz`: criacao e reuso de quiz
- `backend/src/whatsapp`: envio, webhook, quiz e audio
- `backend/prisma/schema.prisma`: modelagem principal do banco

## Setup Rapido

### Requisitos

- Node.js 18+
- Docker e Docker Compose
- chave da OpenAI

### Variaveis Importantes

Exemplo simplificado de `backend/.env`:

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
BACKEND_URL="http://host.docker.internal:3001"
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="global_api_key_talkion"
EVOLUTION_INSTANCE_NAME="talkion_main"
ALLOW_SELF_WHATSAPP_TEST="true"
```

Observacao:

- `ALLOW_SELF_WHATSAPP_TEST=true` foi usado para testes locais;
- antes de producao, essa flag deve ser desativada.

### Como Rodar

1. Instale as dependencias:

```bash
cd backend
npm install
```

2. Suba a infraestrutura:

```bash
cd ..
docker-compose up -d
```

3. Rode as migrations:

```bash
cd backend
npx prisma migrate dev
```

4. Inicie o backend:

```bash
npm run start:dev
```

## Endpoints Principais

- `GET /whatsapp/status`
- `GET /whatsapp/qrcode`
- `POST /whatsapp/webhook/register`
- `DELETE /whatsapp/logout`
- `POST /whatsapp/webhook`
- `POST /whatsapp/test-send`
- `POST /whatsapp/send-latest-news-quiz`

### Exemplo De Envio

```json
{
  "number": "5514991828055"
}
```

### Exemplo De Teste Forcando Modo

```json
{
  "number": "5514991828055",
  "mode": "GROUP"
}
```

Valores aceitos em `mode`:

- `PRIVATE`
- `GROUP`

Sem `mode`, o backend detecta automaticamente pelo destino.

## Estado Atual

O sistema ja suporta:

- noticias por nivel;
- quiz reutilizavel;
- envio privado e em grupo;
- gabarito no dia seguinte;
- speaking com IA real;
- associacao por mensagem citada;
- historico para futuras metricas de engajamento.

## Roadmap

- dashboard administrativo;
- ranking de alunos;
- analise de engajamento;
- gestao real de grupos;
- automacao por agendamento;
- refinamento dos templates de mensagem.
