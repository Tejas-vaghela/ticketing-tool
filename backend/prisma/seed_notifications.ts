import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sampleNotifs = [
    // user-1 (Tejas Chauhan - Admin)
    {
      userId: 'user-1',
      title: 'New Ticket Assigned',
      message: 'You have been assigned INB-1001 "Customer unable to login via Microsoft Azure SSO".',
      type: NotificationType.assignment,
      issueId: 'INB-1001',
      read: false,
    },
    {
      userId: 'user-1',
      title: 'New Comment on INB-1002',
      message: 'Rahul Sharma commented: "Root cause confirmed in payment webhook schema validation."',
      type: NotificationType.comment,
      issueId: 'INB-1002',
      read: false,
    },
    {
      userId: 'user-1',
      title: 'Status Changed: INB-1004',
      message: 'Ticket INB-1004 has moved from "Open" to "In Progress".',
      type: NotificationType.status,
      issueId: 'INB-1004',
      read: false,
    },
    {
      userId: 'user-1',
      title: 'Ticket Escalated: INB-1003',
      message: 'INB-1003 has been escalated to L3. Reason: Database deadlock on bulk batch job.',
      type: NotificationType.escalation,
      issueId: 'INB-1003',
      read: false,
    },
    {
      userId: 'user-1',
      title: 'Sprint 3 Started: Sprint 3',
      message: 'Sprint 3 has begun in project INB.',
      type: NotificationType.sprint,
      issueId: null,
      read: false,
    },
    {
      userId: 'user-1',
      title: 'Security Advisory',
      message: 'Scheduled maintenance window on Sunday at 02:00 UTC.',
      type: NotificationType.system,
      issueId: null,
      read: false,
    },

    // user-2 (Rahul Sharma - Support Agent)
    {
      userId: 'user-2',
      title: 'Ticket Assigned: INB-1002',
      message: 'You have been assigned INB-1002 "Payment API returns 500 when customer completes checkout".',
      type: NotificationType.assignment,
      issueId: 'INB-1002',
      read: false,
    },
    {
      userId: 'user-2',
      title: 'New Comment on INB-1001',
      message: 'Tejas Chauhan commented: "Please test with staging tenant creds and confirm fix."',
      type: NotificationType.comment,
      issueId: 'INB-1001',
      read: false,
    },
    {
      userId: 'user-2',
      title: 'Status Changed: INB-1006',
      message: 'Ticket INB-1006 has moved from "In Progress" to "Resolved".',
      type: NotificationType.status,
      issueId: 'INB-1006',
      read: false,
    },
    {
      userId: 'user-2',
      title: 'Ticket Escalated: INB-1007',
      message: 'INB-1007 has been escalated to L2. Reason: SSL handshake failure on gateway.',
      type: NotificationType.escalation,
      issueId: 'INB-1007',
      read: false,
    },
    {
      userId: 'user-2',
      title: 'Sprint 3 Started: Sprint 3',
      message: 'Sprint 3 has begun in project INB.',
      type: NotificationType.sprint,
      issueId: null,
      read: false,
    },
    {
      userId: 'user-2',
      title: 'System Alert',
      message: 'Customer support queue routing updated for tier L1 agents.',
      type: NotificationType.system,
      issueId: null,
      read: false,
    },
  ];

  for (const n of sampleNotifs) {
    await prisma.notification.create({ data: n });
  }

  const u1Count = await prisma.notification.count({ where: { userId: 'user-1', read: false } });
  const u2Count = await prisma.notification.count({ where: { userId: 'user-2', read: false } });
  console.log(`Seeded notifications! Unread user-1: ${u1Count}, Unread user-2: ${u2Count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
