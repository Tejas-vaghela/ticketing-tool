const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuery(identifier) {
  console.log('Testing identifier:', identifier);
  try {
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier.toLowerCase(), mode: 'insensitive' } },
          { id: identifier },
        ],
      },
    });
    console.log('Result:', dbUser ? { id: dbUser.id, email: dbUser.email, role: dbUser.role, hasPass: !!dbUser.password } : 'NOT FOUND');
  } catch (err) {
    console.error('Query error:', err);
  }
}

async function run() {
  await testQuery('tejaa24@gmail.com');
  await testQuery('Tejaa24@gmail.com ');
  await testQuery('vandansangaddddiya7177@gmail.com');
  await testQuery('cmv6o04wd0005bkxohi85fib3');
}

run().finally(() => prisma.$disconnect());
