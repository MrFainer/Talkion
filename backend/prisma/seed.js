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
        },
      });
      console.log(`[seed] Admin atualizado (role/email_verified/active): ${adminEmail}`);
    } else {
      console.log(`[seed] Admin já existe: ${adminEmail}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[seed] Erro:', err?.message || err);
  process.exit(1);
});
