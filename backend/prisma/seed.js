const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv/config');

const buildPrisma = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definido.');
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

async function main() {
  const prisma = buildPrisma();

  const adminEmail = 'admin@talkion.com';
  const adminName = 'Admin';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const generatedPassword = [
      crypto.randomBytes(12).toString('base64url'),
      'A!',
      '9',
    ].join('');
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
        email_verified: true,
        verification_token: null,
        active: true,
      },
    });
    console.log(`[seed] Admin criado: ${adminEmail}`);
    console.log(`[seed] Senha inicial: ${generatedPassword}`);
  } else {
    const newPassword = 'lxYr9zY6zpB5BPNnA!9';
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const needsUpdate =
      existing.role !== 'ADMIN' ||
      existing.email_verified !== true ||
      existing.active !== true;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'ADMIN',
          email_verified: true,
          active: true,
          password_hash: newPasswordHash,
        },
      });
      console.log(`[seed] Admin atualizado (role/email_verified/active): ${adminEmail}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password_hash: newPasswordHash },
      });
      console.log(`[seed] Admin já existe: ${adminEmail}`);
    }
    console.log(`[seed] Senha do admin atualizada para: ${newPassword}`);
  }

  // ─── Credit Action Configs ────────────────────────────────────────
  const creditActions = [
    // Conteúdo
    { key: 'news_capture_level_1', name: 'Captura de notícia Nível 1', description: 'Captura de notícia por scraping para nível 1', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_capture_level_2', name: 'Captura de notícia Nível 2', description: 'Captura de notícia por scraping para nível 2', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_capture_level_3', name: 'Captura de notícia Nível 3', description: 'Captura de notícia por scraping para nível 3', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_ai_fallback', name: 'Notícia gerada por IA (fallback)', description: 'Geração de notícia via IA quando scraping falha', category: 'content', default_cost: 15, current_cost: 15 },
    { key: 'news_tts', name: 'Áudio TTS da notícia', description: 'Geração de áudio por texto-fala para notícia', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'quiz_generation', name: 'Quiz gerado para um nível', description: 'Geração de quiz para uma notícia em um nível', category: 'content', default_cost: 10, current_cost: 10 },
    // Distribuição
    { key: 'news_quiz_group_send', name: 'Envio da notícia + quiz para grupo', description: 'Envio da notícia e quiz para grupo de WhatsApp', category: 'distribution', default_cost: 2, current_cost: 2 },
    { key: 'quiz_response_received', name: 'Receber resposta do quiz', description: 'Processamento de resposta de quiz recebida', category: 'distribution', default_cost: 1, current_cost: 1 },
    { key: 'quiz_response_metrics', name: 'Salvar métricas da resposta', description: 'Armazenamento de métricas da resposta do quiz', category: 'distribution', default_cost: 1, current_cost: 1 },
    { key: 'news_individual_send', name: 'Envio individual de notícia', description: 'Envio de notícia individual para aluno', category: 'distribution', default_cost: 1, current_cost: 1 },
    // Speaking
    { key: 'speaking_transcription', name: 'Transcrição de áudio', description: 'Transcrição de áudio do aluno via IA', category: 'speaking', default_cost: 10, current_cost: 10 },
    { key: 'speaking_feedback', name: 'Feedback da IA', description: 'Geração de feedback de speaking pela IA', category: 'speaking', default_cost: 15, current_cost: 15 },
    // Aulas
    { key: 'lesson_confirmation_send', name: 'Envio de confirmação de aula', description: 'Envio de mensagem de confirmação de aula', category: 'lessons', default_cost: 1, current_cost: 1 },
    { key: 'lesson_confirmation_process', name: 'Interpretação da resposta pela IA', description: 'Processamento da resposta de confirmação pela IA', category: 'lessons', default_cost: 1, current_cost: 1 },

  ];

  for (const action of creditActions) {
    const existing = await prisma.creditActionConfig.findUnique({ where: { key: action.key } });
    if (!existing) {
      await prisma.creditActionConfig.create({ data: action });
      console.log(`[seed] Credit action config criada: ${action.key} (${action.current_cost} créditos)`);
    }
  }

  // ─── Professor de Teste ──────────────────────────────────────────
  const teacherEmail = 'professor@talkion.com';
  const existingTeacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!existingTeacher) {
    const teacherPassword = 'Talkion@123';
    const teacherHash = await bcrypt.hash(teacherPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Professor Teste',
        email: teacherEmail,
        password_hash: teacherHash,
        role: 'TEACHER',
        email_verified: true,
        active: true,
        credit_balance: 0,
      },
    });
    console.log(`[seed] Professor criado: ${teacherEmail}`);
    console.log(`[seed] Senha: ${teacherPassword}`);
  } else {
    await prisma.user.update({
      where: { email: teacherEmail },
      data: { credit_balance: 0 },
    });
    console.log(`[seed] Professor já existe: ${teacherEmail} (créditos resetados para 0)`);
  }

  // ─── Planos ──────────────────────────────────────────────────────
  const existingBase = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Base' },
  });
  if (!existingBase) {
    await prisma.subscriptionPlan.create({
      data: {
        name: 'Talkion Base',
        description: 'Plano ideal para professores com até 60 alunos',
        price: 84.90,
        credits: 15000,
        max_students: 60,
        active: true,
      },
    });
    console.log('[seed] Plano criado: Talkion Base (R$79,90/mês)');
  } else {
    await prisma.subscriptionPlan.update({
      where: { id: existingBase.id },
      data: {
        description: 'Plano ideal para professores com até 60 alunos',
        max_students: 60,
      },
    });
    console.log('[seed] Plano Talkion Base atualizado para 60 alunos.');

    await prisma.subscription.updateMany({
      where: {
        plan_id: existingBase.id,
        max_students: { not: 60 },
      },
      data: { max_students: 60 },
    });
    console.log('[seed] Assinaturas do Base sincronizadas para 60 alunos.');
  }

  const existingPremium = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Premium' },
  });
  if (!existingPremium) {
    await prisma.subscriptionPlan.create({
      data: {
        name: 'Talkion Premium',
        description: 'Plano completo para professores com até 100 alunos',
        price: 159.90,
        credits: 30000,
        max_students: 100,
        active: true,
      },
    });
    console.log('[seed] Plano criado: Talkion Premium (R$149,90/mês)');
  } else {
    console.log('[seed] Plano Talkion Premium já existe.');
  }

  // ─── Professor com 60 Alunos (simula professor que já tem alunos cadastrados) ──
  const teacherWithStudentsEmail = 'professor2@talkion.com';
  let teacherWithStudents = await prisma.user.findUnique({ where: { email: teacherWithStudentsEmail } });
  if (!teacherWithStudents) {
    const teacherPassword = 'Talkion@123';
    const teacherHash = await bcrypt.hash(teacherPassword, 10);
    teacherWithStudents = await prisma.user.create({
      data: {
        name: 'Professora Carla',
        email: teacherWithStudentsEmail,
        password_hash: teacherHash,
        role: 'TEACHER',
        email_verified: true,
        active: true,
        credit_balance: 0,
      },
    });
    console.log(`[seed] Professora criada: ${teacherWithStudentsEmail} / ${teacherPassword}`);
  } else {
    await prisma.user.update({
      where: { email: teacherWithStudentsEmail },
      data: { credit_balance: 0 },
    });
    console.log(`[seed] Professora já existe: ${teacherWithStudentsEmail} (créditos resetados para 0)`);
  }

  const existingStudents = await prisma.student.count({
    where: { teacher_id: teacherWithStudents.id },
  });
  if (existingStudents === 0) {
    const studentNames = [
      'Ana Beatriz Santos', 'Bruno Oliveira Lima', 'Camila Souza Rocha', 'Diego Almeida Costa',
      'Eduarda Martins Pereira', 'Felipe Carvalho Silva', 'Gabriela Fernandes Torres',
      'Henrique Barbosa Nunes', 'Isabela Ribeiro Campos', 'João Pedro Araújo Souza',
      'Karina Mendes Barros', 'Leonardo Teixeira Dias', 'Marina Castro Oliveira',
      'Nathan Moreira Gomes', 'Olivia Farias Cardoso', 'Paulo Henrique Vieira',
      'Quintino Azevedo Correia', 'Rafaela Santos Neves', 'Samuel Barbosa Lopes',
      'Tatiana Correia Miranda', 'Ubiratã Melo Franco', 'Valentina Duarte Rios',
      'Washington Luiz Pires', 'Xavier Moreira Campos', 'Yara Figueiredo Vargas',
      'Zélia Cardoso Monteiro', 'Arthur Nogueira Lima', 'Bianca Freitas Prado',
      'Caio Vinícius Moraes', 'Daniela Aparecida Silva', 'Eduardo Henrique Costa',
      'Fernanda Oliveira Souza', 'Gabriel Augusto Martins', 'Helena Rodrigues Dias',
      'Igor Santana Pereira', 'Julia Carvalho Barbosa', 'Kauã Almeida Sales',
      'Larissa Cristina Neves', 'Marcos Vinicius Gomes', 'Nicolas Fernandes Rocha',
      'Priscila Santos Campos', 'Renato Oliveira Barros', 'Sabrina Castro Mendes',
      'Thiago Nascimento Silva', 'Ursula Batista Teixeira', 'Vítor Hugo Moreira',
      'Wanessa Gonçalves Luz', 'Yuri Cavalcanti Lima', 'Alice Pereira Duarte',
      'Benjamin Torres Novaes', 'Cecília Ribeiro Franco', 'Davi Araújo Melo',
      'Elisa Andrade Correia', 'Fábio Henrique Vargas', 'Giovana Martins Rios',
      'Hugo Leonardo Faria', 'Isadora Cardoso Sales', 'Joaquim Oliveira Neves',
      'Laura Carvalho Pires',
    ];
    for (let i = 0; i < studentNames.length; i++) {
      const sanitized = studentNames[i]
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '').toLowerCase();
      const whatsappNumber = `551199999${String(100 + i).padStart(4, '0')}`;
      await prisma.student.create({
        data: {
          teacher_id: teacherWithStudents.id,
          full_name: studentNames[i],
          whatsapp_number: whatsappNumber,
          whatsapp_valid: false,
          english_level: i % 3 === 0 ? 'LEVEL_3' : i % 3 === 1 ? 'LEVEL_2' : 'LEVEL_1',
          active: true,
        },
      });
    }
    console.log(`[seed] ${studentNames.length} alunos criados para professora Carla`);
  } else {
    console.log(`[seed] Professora Carla já tem ${existingStudents} alunos`);
  }

  // ─── Um aluno extra para professora Carla ──────────────────────
  const extraStudentPhone = '5511999999059';
  const extraExists = await prisma.student.findUnique({ where: { whatsapp_number: extraStudentPhone } });
  if (!extraExists) {
    await prisma.student.create({
      data: {
        teacher_id: teacherWithStudents.id,
        full_name: 'Cristiano Ronaldo dos Santos',
        whatsapp_number: extraStudentPhone,
        whatsapp_valid: false,
        english_level: 'LEVEL_2',
        active: true,
      },
    });
    console.log('[seed] Aluno extra criado para professora Carla: Cristiano Ronaldo');
  } else {
    console.log('[seed] Aluno extra já existe para professora Carla.');
  }

  // ─── Professor Teste 2 ──────────────────────────────────────────
  const teacher3Email = 'professor3@talkion.com';
  const existingTeacher3 = await prisma.user.findUnique({ where: { email: teacher3Email } });
  if (!existingTeacher3) {
    const teacher3Password = 'Talkion@123';
    const teacher3Hash = await bcrypt.hash(teacher3Password, 10);
    await prisma.user.create({
      data: {
        name: 'Professor Teste 2',
        email: teacher3Email,
        password_hash: teacher3Hash,
        role: 'TEACHER',
        email_verified: true,
        active: true,
        credit_balance: 0,
      },
    });
    console.log(`[seed] Professor criado: ${teacher3Email}`);
    console.log(`[seed] Senha: ${teacher3Password}`);
  } else {
    await prisma.user.update({
      where: { email: teacher3Email },
      data: { credit_balance: 0 },
    });
    console.log(`[seed] Professor já existe: ${teacher3Email} (créditos resetados para 0)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed] Erro:', err?.message || err);
  process.exit(1);
});
