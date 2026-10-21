import { PrismaClient, UserRole, SupportLevel, UserStatus, IssueType, IssueStatus, Priority } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

interface SeedAccount {
  id: string;
  name: string;
  email: string;
  passwordPlain: string;
  role: UserRole;
  department: string;
  supportLevels: SupportLevel[];
  avatar: string;
  timezone: string;
  status: UserStatus;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    id: 'user-1',
    name: 'Tejas Chauhan',
    email: 'tejas@inbox.GoldMine.io',
    passwordPlain: 'admin123',
    role: UserRole.Admin,
    department: 'Engineering & Operations',
    supportLevels: [SupportLevel.L1, SupportLevel.L2, SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-2',
    name: 'Rahul Sharma',
    email: 'rahul.s@inbox.GoldMine.io',
    passwordPlain: 'support123',
    role: UserRole.Support_Agent,
    department: 'Customer Support',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-3',
    name: 'Priya Patel',
    email: 'priya.p@inbox.GoldMine.io',
    passwordPlain: 'tech123',
    role: UserRole.Technical,
    department: 'Technical Operations',
    supportLevels: [SupportLevel.L2],
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-4',
    name: 'Amit Shah',
    email: 'amit.shah@inbox.GoldMine.io',
    passwordPlain: 'engineer123',
    role: UserRole.Engineer,
    department: 'Core Platform Engineering',
    supportLevels: [SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-5',
    name: 'Neha Mehta',
    email: 'neha.m@inbox.GoldMine.io',
    passwordPlain: 'support123',
    role: UserRole.Support_Agent,
    department: 'Customer Support',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Away,
  },
  {
    id: 'user-6',
    name: 'Vivek Joshi',
    email: 'vivek.j@inbox.GoldMine.io',
    passwordPlain: 'engineer123',
    role: UserRole.Engineer,
    department: 'Backend Infrastructure',
    supportLevels: [SupportLevel.L3],
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-7',
    name: 'Ananya Roy',
    email: 'ananya.r@inbox.GoldMine.io',
    passwordPlain: 'qa123',
    role: UserRole.QA,
    department: 'Quality Assurance',
    supportLevels: [SupportLevel.L1, SupportLevel.L2],
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Active,
  },
  {
    id: 'user-8',
    name: 'Vikram Rao',
    email: 'vikram.r@inbox.GoldMine.io',
    passwordPlain: 'pm123',
    role: UserRole.Project_Manager,
    department: 'Product Delivery',
    supportLevels: [SupportLevel.L1],
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    timezone: 'UTC+05:30 (IST)',
    status: UserStatus.Offline,
  },
];

async function main() {
  console.log('--- Starting Database Seed for Users ---');

  for (const account of SEED_ACCOUNTS) {
    // Check if user already exists by email or id
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: account.email.toLowerCase(), mode: 'insensitive' } },
          { id: account.id },
        ],
      },
    });

    if (existing) {
      console.log(`User already exists: ${account.email} (id: ${existing.id})`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(account.passwordPlain, SALT_ROUNDS);

    const created = await prisma.user.create({
      data: {
        id: account.id,
        name: account.name,
        email: account.email.toLowerCase(),
        password: hashedPassword,
        role: account.role,
        department: account.department,
        supportLevels: account.supportLevels,
        avatar: account.avatar,
        timezone: account.timezone,
        status: account.status,
      },
    });

    console.log(`Seeded user: ${created.name} <${created.email}> (id: ${created.id}, role: ${created.role})`);
  }

  const userCount = await prisma.user.count();
  console.log(`--- User seeding complete. Total users in database: ${userCount} ---`);

  // --- Seed Projects, Sprints, Epics, and Initial Issues ---
  const seedDataPath = path.join(__dirname, 'seed-data.json');
  if (fs.existsSync(seedDataPath)) {
    console.log('--- Loading seed-data.json for projects, sprints, epics, and issues ---');
    const raw = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));

    // 1. Projects
    for (const proj of raw.projects || []) {
      const existing = await prisma.project.findFirst({
        where: {
          OR: [{ id: proj.id }, { key: proj.key }],
        },
      });
      if (!existing) {
        await prisma.project.create({
          data: {
            id: proj.id,
            key: proj.key,
            name: proj.name,
            description: proj.description || '',
            category: 'Software',
            leadId: proj.leadId,
            status: proj.status === 'Planning' ? 'Planning' : 'Active',
            createdDate: new Date(proj.createdDate || Date.now()),
          },
        });
        console.log(`Seeded project: ${proj.name} (${proj.key}, id: ${proj.id})`);
      }
    }

    // 2. Sprints
    for (const sprint of raw.sprints || []) {
      const existing = await prisma.sprint.findUnique({ where: { id: sprint.id } });
      if (!existing) {
        await prisma.sprint.create({
          data: {
            id: sprint.id,
            projectId: sprint.projectId,
            name: sprint.name,
            startDate: new Date(sprint.startDate),
            endDate: new Date(sprint.endDate),
            status: sprint.status,
            goal: sprint.goal,
            completedDate: sprint.completedDate ? new Date(sprint.completedDate) : null,
          },
        });
        console.log(`Seeded sprint: ${sprint.name} (id: ${sprint.id})`);
      }
    }

    // 3. Epics
    for (const epic of raw.epics || []) {
      const existing = await prisma.epic.findUnique({ where: { id: epic.id } });
      if (!existing) {
        await prisma.epic.create({
          data: {
            id: epic.id,
            projectId: epic.projectId,
            name: epic.name,
            description: epic.description || '',
            color: epic.color || '#3b82f6',
            status: epic.status === 'Done' ? 'Done' : epic.status === 'In Progress' ? 'In_Progress' : 'To_Do',
            dueDate: epic.dueDate ? new Date(epic.dueDate) : null,
          },
        });
        console.log(`Seeded epic: ${epic.name} (id: ${epic.id})`);
      }
    }

    // 4. Issues
    const typeMap: Record<string, IssueType> = {
      Task: IssueType.Task,
      Bug: IssueType.Bug,
      Story: IssueType.Story,
      Epic: IssueType.Epic,
      'Sub-task': IssueType.Sub_task,
    };
    const statusMap: Record<string, IssueStatus> = {
      Open: IssueStatus.Open,
      'To Do': IssueStatus.To_Do,
      'In Progress': IssueStatus.In_Progress,
      'In Review': IssueStatus.In_Review,
      Testing: IssueStatus.Testing,
      Blocked: IssueStatus.Blocked,
      Resolved: IssueStatus.Resolved,
      Closed: IssueStatus.Closed,
    };

    const sprintProjectMap = new Map<string, string>();
    for (const s of raw.sprints || []) {
      sprintProjectMap.set(s.id, s.projectId);
    }

    let seededIssues = 0;
    for (const issue of raw.issues || []) {
      const existing = await prisma.issue.findUnique({ where: { id: issue.id } });
      if (!existing) {
        const targetProjectId = issue.projectId || 'proj-1';
        let validatedSprintId = issue.sprintId || null;
        if (validatedSprintId && sprintProjectMap.has(validatedSprintId)) {
          if (sprintProjectMap.get(validatedSprintId) !== targetProjectId) {
            validatedSprintId = null; // Prevent cross-project sprint assignment
          }
        }

        await prisma.issue.create({
          data: {
            id: issue.id,
            title: issue.title,
            description: issue.description || '',
            type: typeMap[issue.type] || IssueType.Task,
            status: statusMap[issue.status] || IssueStatus.Open,
            priority: (issue.priority as Priority) || Priority.Medium,
            supportLevel: (issue.supportLevel as SupportLevel) || SupportLevel.L1,
            assigneeId: issue.assigneeId || null,
            reporterId: issue.reporterId || 'user-1',
            projectId: targetProjectId,
            sprintId: validatedSprintId,
            epicId: issue.epicId || null,
            labels: issue.labels || [],
            dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
            createdDate: issue.createdDate ? new Date(issue.createdDate) : new Date(),
            updatedDate: issue.updatedDate ? new Date(issue.updatedDate) : new Date(),
            estimatedTime: issue.estimatedTime || null,
            remainingTime: issue.remainingTime || null,
            storyPoints: issue.storyPoints || null,
            responseSLAHours: issue.responseSLAHours || 4.0,
            resolutionSLAHours: issue.resolutionSLAHours || 24.0,
            firstRespondedAt: issue.firstRespondedAt ? new Date(issue.firstRespondedAt) : null,
            resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt) : null,
            isEscalated: !!issue.isEscalated,
          },
        });
        seededIssues++;
      }
    }
    console.log(`Seeded ${seededIssues} new issues.`);
  }

  const issueCount = await prisma.issue.count();
  console.log(`--- Seeding complete. Total issues in database: ${issueCount} ---`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
