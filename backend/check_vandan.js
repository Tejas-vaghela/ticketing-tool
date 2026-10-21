const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'vandansangaddddiya7177@gmail.com' }
  });
  if (!user) return;

  const candidates = [
    'vandan', 'vandan123', 'vandan@123', 'Vandan@123', 'Vandan123',
    'vandansangaddiya', 'vandansangaddiya7177', '7177', '12345678',
    'password', 'password123', 'welcome123', 'admin123',
    'vandansangaddddiya7177', 'vandansangaddddiya', 'vandansangaddddiya7177@gmail.com'
  ];

  for (const c of candidates) {
    if (await bcrypt.compare(c, user.password)) {
      console.log('MATCH:', c);
      return;
    }
  }
  console.log('No match found in candidates');
}

main().finally(() => prisma.$disconnect());
