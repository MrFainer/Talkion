# Talkion

Talkion é uma plataforma de aprendizado de inglês via WhatsApp que transforma notícias reais em uma rotina diária de estudo com leitura, quiz e speaking com IA.

## Proposta

Em vez de obrigar o aluno a abrir uma plataforma toda vez que quiser estudar, o Talkion leva o conteúdo para o canal onde ele já está: o WhatsApp.

O sistema usa notícias em inglês como base para uma experiência contínua de aprendizagem:

- leitura com conteúdo real;
- quiz curto e objetivo;
- speaking com envio de áudio;
- feedback automático com IA;
- histórico de interações para evolução futura.

## Destaques

- notícias diárias por nível com scraping do `newsinlevels.com`;
- fallback por IA quando o scraping falha;
- quiz automático com `3 perguntas` e `3 alternativas`;
- speaking com transcrição real usando `whisper-1`;
- feedback pedagógico com `gpt-4o-mini`;
- envio separado para `privado` e `grupo`;
- gabarito do quiz enviado no ciclo seguinte;
- resolução por mensagem citada no WhatsApp;
- persistência de respostas, áudios e feedbacks.

## Como O Produto Funciona

### Fluxo Privado

Usado para o aluno praticar speaking:

1. envio de `Good morning` com o dia da semana;
2. introdução do desafio de speaking;
3. bloco de transição para a notícia do dia;
4. envio da notícia;
5. aluno responde com áudio;
6. sistema avalia e devolve feedback.

### Fluxo Grupo

Usado para leitura e participação coletiva:

1. envio de `Good morning` com o dia da semana;
2. gabarito do quiz anterior, quando existir;
3. bloco de transição para a notícia do dia;
4. envio da notícia;
5. cabeçalho do quiz;
6. envio do quiz;
7. alunos respondem no grupo.

## Diferenciais Do Fluxo

- o quiz não responde imediatamente no grupo;
- o gabarito aparece no próximo ciclo diário;
- o aluno pode responder usando mensagem citada;
- o áudio pode ser associado automaticamente à notícia correta;
- o quiz pode ser associado automaticamente ao envio correto;
- o sistema evita gerar quiz repetido para a mesma notícia.

## Regras De Negócio Atuais

- quiz com exatamente `3 perguntas` e `3 alternativas`;
- formatos aceitos: `A,B,C`, `A, B, C`, `1A,2B,3C`, `1A, 2B, 3C`;
- uma linha em `QuizAnswer` por aluno por quiz;
- `is_correct` só fica `true` quando o quiz inteiro está correto;
- reenvios do mesmo quiz pelo mesmo aluno são ignorados;
- speaking usa mensagem citada ou fallback para a notícia mais recente do nível.

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

### Infraestrutura E Integrações

- Evolution API
- Docker
- Docker Compose
- Redis

## Estrutura Do Projeto

- `backend/src/news`: scraping, limpeza e persistência das notícias
- `backend/src/ai`: fallback de notícia, geração de quiz e feedback de speaking
- `backend/src/quiz`: criação e reuso de quiz
- `backend/src/whatsapp`: envio, webhook, quiz e áudio
- `backend/prisma/schema.prisma`: modelagem principal do banco

## Setup Rápido

### Requisitos

- Node.js 18+
- Docker e Docker Compose
- chave da OpenAI

### Variáveis Importantes

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

Observação:

- `ALLOW_SELF_WHATSAPP_TEST=true` foi usado para testes locais;
- antes de produção, essa flag deve ser desativada.

### Como Rodar

1. Instale as dependências:

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

### Exemplo De Teste Forçando Modo

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

O sistema já suporta:

- notícias por nível;
- quiz reutilizável;
- envio privado e em grupo;
- gabarito no dia seguinte;
- speaking com IA real;
- associação por mensagem citada;
- histórico para futuras métricas de engajamento;
- dashboard administrativo para gestão de professores e monitoramento de custos;
- tela de configurações de mensagens permitindo ao professor customizar saudação, fluxos e variáveis dinâmicas;
- rastreamento detalhado de custos e uso da OpenAI (LLM: input/output/total tokens, Whisper: segundos) vinculado a cada professor e aluno, base para faturamento;
- arquitetura Multi-Tenant isolando webhooks, notícias e configurações dinamicamente por `teacher_id`.

## Roadmap

- ranking de alunos;
- análise de engajamento;
- gestão real de grupos;
- automação por agendamento;
