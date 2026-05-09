# 🎓 Talkion - AI English Learning Platform

Talkion is an intelligent, WhatsApp-based English learning platform designed to help students improve their reading, comprehension, and speaking skills through daily interactions with real-world news and AI-driven feedback.

## 🚀 Overview

The platform acts as an automated English tutor. Every day, it automatically scrapes news articles (categorized by difficulty levels 1, 2, and 3), generates reading comprehension quizzes using AI, and delivers them directly to students via WhatsApp. It also evaluates students' spoken English by analyzing voice notes sent in response to the news.

## ✨ Core Features

*   **📰 Automated News Scraping:** Daily extraction of English news from *newsinlevels.com*, categorized by difficulty.
*   **🤖 AI Fallback Generation:** If the scraper fails or the source is unavailable, the system automatically uses OpenAI (`gpt-4o-mini`) to generate a custom, level-appropriate news article.
*   **🧠 Smart Quiz Generation:** Automatically creates 3-question multiple-choice quizzes based on the daily news content using OpenAI.
*   **📱 WhatsApp Integration:** Seamlessly connects with WhatsApp (via Evolution API/Baileys) to send news/quizzes to groups or individual students.
*   **🎤 Speaking Evaluation:** Receives audio messages (voice notes) from students, transcribes them, and uses AI to provide a score (0-10) and detailed feedback on pronunciation and mistakes.
*   **✅ Automated Grading:** Evaluates quiz answers sent via WhatsApp text messages and provides immediate feedback.

## 🛠️ Tech Stack

### Backend
*   **[NestJS](https://nestjs.com/):** Progressive Node.js framework for building efficient and scalable server-side applications.
*   **TypeScript:** Strictly typed JavaScript.
*   **[Prisma ORM](https://www.prisma.io/):** Next-generation Node.js and TypeScript ORM for PostgreSQL.
*   **PostgreSQL:** Relational database for storing users, students, news, quizzes, and interactions.
*   **Cheerio & Axios:** For web scraping and DOM manipulation.

### Artificial Intelligence
*   **OpenAI API (`gpt-4o-mini`):** Used for generating quizzes, fallback news, and evaluating speaking feedback.

### Infrastructure & Integrations
*   **Docker & Docker Compose:** Containerized environment for the database, Redis, and APIs.
*   **[Evolution API](https://evolution-api.com/):** WhatsApp API integration based on the Baileys library.
*   **Redis:** Caching and queue management for the Evolution API.

## 📦 Architecture Modules

1.  **News Scraper Service:** Responsible for fetching, cleaning, and storing daily news.
2.  **AI Service:** The core brain handling fallback content creation, quiz generation, and speaking evaluation.
3.  **Quiz Service:** Manages the creation of quizzes and validates student answers.
4.  **WhatsApp Service:** Handles outgoing messages and processes incoming webhooks (text answers and audio submissions) from the Evolution API.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Docker & Docker Compose
*   An OpenAI API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/talkion.git
   cd talkion/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the `backend` directory based on the `.env.example` file:
   ```env
   DATABASE_URL="postgresql://talkion:talkionpassword@localhost:5433/talkion_db?schema=public"
   OPENAI_API_KEY="your-openai-api-key"
   EVOLUTION_API_URL="http://localhost:8080"
   EVOLUTION_API_KEY="global_api_key_talkion"
   ```

4. Start the infrastructure (Database, Redis, Evolution API):
   ```bash
   cd ..
   docker-compose up -d
   ```

5. Run database migrations:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

6. Start the NestJS server:
   ```bash
   npm run start:dev
   ```

## 📱 WhatsApp Setup (Evolution API)

1. Connect your WhatsApp number by generating a QR Code via the Evolution API instance.
2. Configure the webhook to point to `http://<your-ip>:3001/whatsapp/webhook` to receive incoming messages.

## 📝 Future Roadmap

*   Web Dashboard for Teachers (Frontend Admin)
*   Gamification, Streaks, and Leaderboards
*   Flashcards and Vocabulary Tracking
*   Telegram and Discord Integrations

---
*Developed as an intelligent solution to make language learning natural, continuous, and integrated into daily communication.*