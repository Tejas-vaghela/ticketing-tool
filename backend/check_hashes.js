const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'vandansangaddddiya7177@gmail.com',
          'meeeet121212@gmail.com',
          'part12@gmail.com',
          'tejaa24@gmail.com'
        ]
      }
    }
  });

  const candidates = [
    'welcome123',
    'admin123',
    'password123',
    '12345678',
    'Teja@2424126',
    'teja1234',
    'Tejas123',
    'Tejas@123',
    'testpassword123',
  ];

  for (const u of users) {
    console.log(`\nUser: ${u.email} (id: ${u.id})`);
    console.log(`Hash in DB: ${u.password}`);
    let matched = false;
    for (const c of candidates) {
      if (await bcrypt.compare(c, u.password)) {
        console.log(`  >>> MATCH FOUND for candidate "${c}"!`);
        matched = true;
      }
    }
    if (!matched) {
      console.log('  No common candidate matched.');
    }
  }
}

main().finally(() => prisma.$disconnect());
