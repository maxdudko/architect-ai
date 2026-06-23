import * as bcrypt from 'bcrypt';
import {
  MembershipStatus,
  PrismaClient,
  WorkspacePlan,
  WorkspaceRole,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'owner@architect.ai' },
    update: {},
    create: {
      email: 'owner@architect.ai',
      passwordHash,
      firstName: 'Owner',
      lastName: 'User',
      emailVerified: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'owner-workspace' },
    update: {},
    create: {
      name: "Owner's Workspace",
      slug: 'owner-workspace',
      plan: WorkspacePlan.PRO,
    },
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
}

void main()
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
