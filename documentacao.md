# 📄 Documentação Completa — Plataforma de Inglês com IA via WhatsApp

# 🧠 Visão Geral

Este projeto consiste em uma plataforma integrada ao WhatsApp para auxiliar alunos no aprendizado de inglês através de:

- Envio diário de notícias em inglês
- Geração automática de quizzes baseados nas notícias
- Interação automática em grupos de WhatsApp
- Treinamento de speaking via envio de áudios
- Avaliação automatizada da pronúncia e fluência utilizando IA
- Correção diária de quizzes
- Engajamento contínuo dos alunos

A plataforma funciona como um assistente inteligente de aprendizado contínuo, incentivando:

- Reading
- Speaking
- Listening
- Vocabulário
- Interpretação
- Pronúncia
- Fluência

---

# 🎯 Objetivo Principal

Transformar conteúdos reais do dia a dia em experiências práticas de aprendizado de inglês utilizando:

- Inteligência Artificial
- WhatsApp
- Automação
- Gamificação
- Feedback personalizado

---

# 🏗️ Arquitetura Geral

## 📌 Arquitetura em Alto Nível

```txt
[Frontend Admin]
        |
        v
[API Gateway / Backend]
        |
        ├── Auth Service
        ├── News Scraper Service
        ├── AI News Generator Service
        ├── Quiz Generator Service
        ├── WhatsApp Integration Service
        ├── Audio Processing Service
        ├── AI Feedback Service
        ├── Engagement Service
        ├── Logging & Analytics
        |
        v
[Database (PostgreSQL)]
        |
        v
[Queue (Redis / RabbitMQ)]
        |
        v
[Workers (IA / Áudio / Scraping)]
```

---

# 🧱 Stack Tecnológica

## 🔹 Frontend

- React
- Next.js
- TailwindCSS
- ShadCN UI
- Zustand ou Redux

---

## 🔹 Backend

- Node.js
- NestJS
- REST API
- WebSockets

### Arquitetura

- Controller ➔ Service ➔ Repository

---

## 🔹 Banco de Dados

- PostgreSQL
- Redis

---

## 🔹 Infraestrutura

- Docker
- Docker Compose
- Kubernetes (futuro)
- Nginx

---

## 🔹 Integração WhatsApp

- EvolutionAPI
- Webhooks
- Mensagens em grupo
- Mensagens privadas

---

## 🔹 Inteligência Artificial

- OpenAI GPT-4o
- Whisper (Speech-to-Text)
- Embeddings (futuro)

---

# 📚 Funcionalidades Principais

# 1. 📰 Captura Automática de Notícias

A plataforma acessa periodicamente o site:

- `newsinlevels.com`

Objetivos:

- Buscar notícias em inglês
- Filtrar conteúdos interessantes
- Identificar nível da notícia:
  - Level 1
  - Level 2
  - Level 3

---

## 📌 Fluxo

```txt
1. Worker acessa o site
2. Extrai:
   - título
   - conteúdo
   - nível
   - link
3. Valida conteúdo
4. Salva no banco
5. Envia para geração do quiz
```

---

# 🔄 Estratégia de Contingência

## 📌 Fallback Inteligente

Caso o site:

- esteja offline;
- indisponível;
- bloqueie scraping;
- retorne erro;
- esteja lento;
- retorne conteúdo inválido;

o sistema deverá gerar automaticamente uma notícia utilizando uma LLM.

---

# 🤖 Geração de Notícias com IA

Quando o fallback for acionado, a IA deverá:

- gerar uma notícia original em inglês;
- produzir conteúdo natural;
- adequar o nível do aluno;
- manter contexto educacional;
- criar texto apropriado para:
  - reading;
  - quiz;
  - speaking.

---

## 📌 Níveis Suportados

- Level 1
- Level 2
- Level 3

---

## 📌 Exemplo de Prompt

```txt
Você é um criador de conteúdo educacional para estudantes de inglês.

Gere uma notícia curta em inglês:

Regras:
- Nível: {{level}}
- Tema atual e interessante
- Linguagem natural
- Fácil compreensão
- Aproximadamente 250 palavras
- Inclua título
```

---

## 📌 Ordem de Execução

```txt
1. Buscar notícia do News in Levels
2. Validar conteúdo
3. Caso falhe:
   → gerar notícia via IA
4. Salvar origem da notícia
5. Continuar fluxo normalmente
```

---

# 2. 🧠 Geração de Quiz com IA

Após obter a notícia, a IA gera automaticamente:

- Perguntas de interpretação
- Vocabulário
- Grammar
- Multiple choice
- True or False

---

## 📌 Exemplo de Prompt

```txt
Você é um professor de inglês.

Com base na notícia abaixo, gere:

- 5 perguntas em inglês
- 4 alternativas por pergunta
- Informe a resposta correta
- Nível intermediário

Texto:
{{news_text}}
```

---

## 📌 Exemplo de Output

```json
{
  "question": "What happened in the story?",
  "options": [
    "A new school opened",
    "A storm hit the city",
    "People traveled abroad",
    "A company was sold"
  ],
  "correct_answer": "A storm hit the city"
}
```

---

# 3. 👥 Envio para Grupo do WhatsApp

A notícia e o quiz serão enviados automaticamente nos grupos.

---

## 📌 Estrutura da Mensagem

```txt
📰 Daily English News

Title:
{{title}}

Level:
{{level}}

News:
{{text}}

📚 Quiz Time!

1. ...
2. ...
3. ...
```

---

# 4. ✅ Correção do Quiz no Dia Seguinte

As respostas corretas do quiz NÃO serão enviadas imediatamente.

A correção será enviada apenas no próximo ciclo diário.

---

## 📌 Estratégia

### DIA 1

```txt
1. Buscar notícia
2. Gerar quiz
3. Enviar notícia + quiz
4. Alunos respondem
```

---

### DIA 2

```txt
1. Enviar respostas corretas do quiz anterior
2. Buscar nova notícia
3. Gerar novo quiz
4. Enviar novo conteúdo
```

---

# 🧠 Estratégia Pedagógica

Essa abordagem aumenta:

- retenção de conteúdo;
- curiosidade;
- engajamento;
- memória ativa;
- frequência de participação.

---

# 5. 🎤 Treinamento de Speaking

A mesma notícia será enviada individualmente para alunos selecionados.

Objetivo:

- O aluno lê a notícia em voz alta;
- envia um áudio no WhatsApp;
- o sistema avalia automaticamente.

---

## 📌 Fluxo

```txt
1. Sistema envia notícia
2. Aluno envia áudio
3. Backend recebe áudio
4. Whisper faz transcrição
5. IA compara:
   - texto original
   - transcrição do aluno
6. Feedback é gerado
7. Resultado enviado ao aluno
```

---

# 6. 🤖 Feedback Inteligente de Pronúncia

A IA analisa:

- Pronúncia
- Clareza
- Fluência
- Ritmo
- Erros de leitura
- Palavras omitidas
- Palavras incorretas

---

## 📌 Exemplo de Prompt

```txt
Você é um professor de inglês especializado em speaking.

Compare:

Texto original:
{{original_text}}

Transcrição do aluno:
{{student_transcription}}

Gere:
- Nota de 0 a 10
- Feedback amigável
- Principais erros
- Dicas de melhoria
```

---

## 📌 Exemplo de Feedback

```json
{
  "score": 8.2,
  "fluency": "Boa",
  "pronunciation": "Intermediária",
  "mistakes": [
    "difficulty",
    "environment"
  ],
  "feedback": "Sua leitura foi muito boa. Trabalhe a pronúncia das palavras mais longas."
}
```

---

# 🔐 Autenticação

## Regras

- Usuários autenticados
- Professores e administradores
- Controle de alunos
- Controle de turmas

---

# 📦 Módulos do Sistema

# 1. 👤 Auth Service

Responsável por:

- Login
- Cadastro
- JWT
- Controle de acesso

---

# 2. 📰 News Scraper Service

Responsável por:

- Acessar o News in Levels
- Extrair notícias
- Categorizar conteúdo

---

# 3. 🤖 AI News Generator Service

Responsável por:

- Gerar notícias em fallback
- Criar conteúdo educacional
- Adaptar nível do texto

---

# 4. 🧠 Quiz Generator Service

Responsável por:

- Geração automática de perguntas
- Correção automática
- Integração com IA

---

# 5. 📱 WhatsApp Integration Service

Responsável por:

- Envio em grupos
- Envio privado
- Recebimento de áudio
- Webhooks
- Controle de mensagens

---

# 6. 🎤 Audio Processing Service

Responsável por:

- Download de áudio
- Conversão de formato
- Speech-to-text

---

# 7. 🤖 AI Feedback Service

Responsável por:

- Análise de speaking
- Correções
- Score
- Recomendações

---

# 8. 📊 Engagement Service

Responsável por:

- Controle de streak
- Ranking
- Participação diária
- Estatísticas

---

# 🗄️ Modelagem de Banco de Dados

## 📌 Tabela: users

```sql
id (UUID)
name
email
password_hash
role
created_at
```

---

## 📌 Tabela: students

```sql
id (UUID)
user_id (UUID)
full_name
whatsapp_number
english_level
active (boolean)
created_at
```

---

## 📌 Tabela: whatsapp_groups

```sql
id (UUID)
group_name
group_identifier
created_at
```

---

## 📌 Tabela: news

```sql
id (UUID)
title
content
level
source_type (scraped | ai_generated)
source_url
created_at
```

---

## 📌 Tabela: quizzes

```sql
id (UUID)
news_id (UUID)
questions (JSONB)
created_at
```

---

## 📌 Tabela: quiz_answers

```sql
id (UUID)
student_id (UUID)
quiz_id (UUID)
question_id
selected_answer
is_correct
created_at
```

---

## 📌 Tabela: whatsapp_messages

```sql
id (UUID)
student_id (UUID)
message_type (group | private)
direction (incoming | outgoing)
content
media_url
created_at
```

---

## 📌 Tabela: audio_submissions

```sql
id (UUID)
student_id (UUID)
news_id (UUID)
audio_url
transcription
created_at
```

---

## 📌 Tabela: speaking_feedbacks

```sql
id (UUID)
audio_submission_id (UUID)
score
feedback
mistakes (JSONB)
created_at
```

---

# 🔄 Fluxos Principais

# 📌 Fluxo Diário

```txt
1. Buscar notícia
2. Validar conteúdo
3. Caso necessário:
   → gerar notícia com IA
4. Processar conteúdo
5. Gerar quiz
6. Enviar correção do quiz anterior
7. Enviar nova notícia
8. Enviar novo quiz
9. Enviar speaking para alunos
```

---

# 📌 Fluxo de Speaking

```txt
1. Aluno recebe notícia
2. Envia áudio
3. Sistema transcreve
4. IA analisa
5. Feedback é gerado
6. Resultado enviado ao aluno
```

---

# ⚙️ Docker Setup

## 📦 Serviços

```yaml
services:
  frontend:
  backend:
  postgres:
  redis:
  evolution-api:
  workers:
```

---

# 📡 Comunicação em Tempo Real

- WebSocket
- Atualização de status
- Logs de processamento
- Feedback em tempo real

---

# 🔐 Segurança

- JWT
- Rate limiting
- Criptografia de dados
- Logs de auditoria
- Controle de acesso

---

# 📊 Escalabilidade

- Workers separados
- Processamento assíncrono
- Filas
- Cache Redis

---

# 📈 Métricas Futuras

O sistema poderá calcular:

- quantidade de quizzes respondidos;
- taxa de acerto;
- evolução do speaking;
- frequência diária;
- ranking de alunos;
- tempo médio de resposta;
- palavras com maior dificuldade.

---

# 🚀 Roadmap Futuro

- Dashboard para professores
- Ranking de alunos
- Gamificação
- Flashcards automáticos
- Correção gramatical avançada
- Conversação em tempo real com IA
- Integração com Telegram
- Integração com Discord
- Recomendações personalizadas via IA

---

# ✅ Conclusão

A plataforma une:

- WhatsApp
- Inteligência Artificial
- Ensino de inglês
- Automação
- Speaking analysis
- Conteúdo real do cotidiano

Criando uma experiência contínua e prática de aprendizado baseada em:

- consumo diário de conteúdo real;
- interação natural;
- feedback automatizado;
- evolução contínua do aluno.

O diferencial do projeto está no uso de IA para transformar notícias reais em experiências completas de aprendizado de inglês com foco em:

- speaking;
- interpretação;
- vocabulário;
- fluência;
- engajamento diário.
````
