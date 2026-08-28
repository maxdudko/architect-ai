import * as bcrypt from 'bcrypt';
import {
  BillingMode,
  // MembershipStatus,
  PrismaClient,
  // WorkspaceRole,
} from '@prisma/client';
import { upsertDefaultPlanLimits } from '../src/usage/plan-limit.defaults';

const PRO_MONTHLY_PRICES: Record<BillingMode, number> = {
  [BillingMode.STANDARD]: 2000,
  [BillingMode.BYOK]: 1200,
};

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Plans must exist before any workspace can reference one via plan_id.
  const planIds = await upsertDefaultPlanLimits(prisma);

  // const passwordHash = await bcrypt.hash('Password123!', 12);

  // const user = await prisma.user.upsert({
  //   where: { email: 'user@email.com' },
  //   update: {},
  //   create: {
  //     email: 'user@email.com',
  //     passwordHash,
  //     firstName: 'User',
  //     lastName: 'X',
  //     emailVerified: true,
  //   },
  // });
  //
  // const workspace = await prisma.workspace.upsert({
  //   where: { slug: 'main-workspace' },
  //   update: {},
  //   create: {
  //     name: 'Main Workspace',
  //     slug: 'main-workspace',
  //     planId: planIds.free,
  //   },
  // });
  //
  // await prisma.membership.upsert({
  //   where: {
  //     workspaceId_userId: {
  //       workspaceId: workspace.id,
  //       userId: user.id,
  //     },
  //   },
  //   update: { role: WorkspaceRole.OWNER, status: MembershipStatus.ACTIVE },
  //   create: {
  //     workspaceId: workspace.id,
  //     userId: user.id,
  //     role: WorkspaceRole.OWNER,
  //     status: MembershipStatus.ACTIVE,
  //   },
  // });

  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 12);
  await prisma.admin.upsert({
    where: { email: 'admin@architect.ai' },
    update: {},
    create: {
      email: 'admin@architect.ai',
      passwordHash: adminPasswordHash,
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });

  for (const [billingMode, amount] of Object.entries(
    PRO_MONTHLY_PRICES,
  ) as Array<[BillingMode, number]>) {
    await prisma.planPrice.upsert({
      where: {
        planId_billingMode_interval: {
          planId: planIds.pro,
          billingMode,
          interval: 'MONTHLY',
        },
      },
      update: {},
      create: {
        planId: planIds.pro,
        billingMode,
        interval: 'MONTHLY',
        amount,
        currency: 'usd',
      },
    });
  }
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
