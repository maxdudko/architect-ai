import { Injectable } from '@nestjs/common';
import {
  AnalyticsEventType,
  AnswerFeedbackRating,
  MessageRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      repositoryConnections,
      indexingSucceeded,
      indexingFailed,
      questionsAsked,
      sourceCitations,
      helpfulCount,
      notHelpfulCount,
      tokenUsage,
      activeUsage,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { type: AnalyticsEventType.REPOSITORY_CONNECTED },
      }),
      this.prisma.analyticsEvent.count({
        where: { type: AnalyticsEventType.REPOSITORY_INDEXING_SUCCEEDED },
      }),
      this.prisma.analyticsEvent.count({
        where: { type: AnalyticsEventType.REPOSITORY_INDEXING_FAILED },
      }),
      this.prisma.message.count({
        where: {
          role: MessageRole.USER,
          conversation: { deletedAt: null },
        },
      }),
      this.prisma.messageSourceCitation.count(),
      this.prisma.answerFeedback.count({
        where: { rating: AnswerFeedbackRating.HELPFUL },
      }),
      this.prisma.answerFeedback.count({
        where: { rating: AnswerFeedbackRating.NOT_HELPFUL },
      }),
      this.getTokenUsageTotals(),
      this.getActiveUsageTotals(),
    ]);

    const feedbackTotal = helpfulCount + notHelpfulCount;

    return {
      repositoryConnections,
      indexingSucceeded,
      indexingFailed,
      questionsAsked,
      sourceCitations,
      feedback: {
        helpful: helpfulCount,
        notHelpful: notHelpfulCount,
        total: feedbackTotal,
        helpfulRate: feedbackTotal === 0 ? null : helpfulCount / feedbackTotal,
      },
      tokenUsage,
      activeUsage,
    };
  }

  async listRepositoryEvents(params: {
    page: number;
    pageSize: number;
    search?: string;
    workspaceId?: string;
    type?: AnalyticsEventType;
  }) {
    const search = params.search?.trim();
    const searchUuid = search ? this.asUuidOrUndefined(search) : undefined;

    const where: Prisma.AnalyticsEventWhereInput = {
      ...(params.type ? { type: params.type } : {}),
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      ...(search
        ? {
            OR: [
              ...(searchUuid
                ? [
                    { workspaceId: searchUuid },
                    { repositoryId: searchUuid },
                    { actorUserId: searchUuid },
                  ]
                : []),
              {
                payload: {
                  path: ['fullName'],
                  string_contains: search,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    const workspaceIds = [...new Set(items.map((item) => item.workspaceId))];
    const userIds = [
      ...new Set(
        items
          .map((item) => item.actorUserId)
          .filter((id): id is string => id != null),
      ),
    ];
    const repositoryIds = [
      ...new Set(
        items
          .map((item) => item.repositoryId)
          .filter((id): id is string => id != null),
      ),
    ];

    const [workspaces, users, repositories] = await Promise.all([
      workspaceIds.length
        ? this.prisma.workspace.findMany({
            where: { id: { in: workspaceIds } },
            select: { id: true, name: true, slug: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : [],
      repositoryIds.length
        ? this.prisma.repository.findMany({
            where: { id: { in: repositoryIds } },
            select: { id: true, fullName: true },
          })
        : [],
    ]);

    const workspaceById = new Map(workspaces.map((w) => [w.id, w]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const repositoryById = new Map(repositories.map((r) => [r.id, r]));

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        workspaceId: item.workspaceId,
        workspaceName: workspaceById.get(item.workspaceId)?.name ?? null,
        workspaceSlug: workspaceById.get(item.workspaceId)?.slug ?? null,
        actorUserId: item.actorUserId,
        actorEmail: item.actorUserId
          ? (userById.get(item.actorUserId)?.email ?? null)
          : null,
        repositoryId: item.repositoryId,
        repositoryFullName: item.repositoryId
          ? (repositoryById.get(item.repositoryId)?.fullName ??
            ((item.payload as { fullName?: string } | null)?.fullName ?? null))
          : null,
        payload: item.payload,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async listQuestions(params: {
    page: number;
    pageSize: number;
    search?: string;
    workspaceId?: string;
  }) {
    const where: Prisma.MessageWhereInput = {
      role: MessageRole.USER,
      conversation: {
        deletedAt: null,
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      },
      ...(params.search
        ? {
            content: {
              contains: params.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          conversation: {
            select: {
              id: true,
              workspaceId: true,
              repositoryId: true,
              createdById: true,
              title: true,
              workspace: { select: { name: true, slug: true } },
              repository: { select: { fullName: true } },
              createdBy: {
                select: { email: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        conversationId: item.conversationId,
        workspaceId: item.conversation.workspaceId,
        workspaceName: item.conversation.workspace.name,
        workspaceSlug: item.conversation.workspace.slug,
        repositoryId: item.conversation.repositoryId,
        repositoryFullName: item.conversation.repository?.fullName ?? null,
        userId: item.conversation.createdById,
        userEmail: item.conversation.createdBy.email,
        conversationTitle: item.conversation.title,
        content:
          item.content.length > 240
            ? `${item.content.slice(0, 240)}…`
            : item.content,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async listSources(params: {
    page: number;
    pageSize: number;
    search?: string;
    workspaceId?: string;
  }) {
    const where: Prisma.MessageSourceCitationWhereInput = {
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      ...(params.search
        ? {
            filePath: {
              contains: params.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const grouped = await this.prisma.messageSourceCitation.groupBy({
      by: ['repositoryId', 'filePath', 'workspaceId'],
      where,
      _count: { _all: true },
      _avg: { score: true },
    });

    const sorted = [...grouped].sort((a, b) => b._count._all - a._count._all);
    const total = sorted.length;
    const pageItems = sorted.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    );

    const repositoryIds = [...new Set(pageItems.map((item) => item.repositoryId))];
    const workspaceIds = [...new Set(pageItems.map((item) => item.workspaceId))];

    const [repositories, workspaces] = await Promise.all([
      repositoryIds.length
        ? this.prisma.repository.findMany({
            where: { id: { in: repositoryIds } },
            select: { id: true, fullName: true },
          })
        : [],
      workspaceIds.length
        ? this.prisma.workspace.findMany({
            where: { id: { in: workspaceIds } },
            select: { id: true, name: true, slug: true },
          })
        : [],
    ]);

    const repositoryById = new Map(repositories.map((r) => [r.id, r]));
    const workspaceById = new Map(workspaces.map((w) => [w.id, w]));

    return {
      items: pageItems.map((item) => ({
        workspaceId: item.workspaceId,
        workspaceName: workspaceById.get(item.workspaceId)?.name ?? null,
        workspaceSlug: workspaceById.get(item.workspaceId)?.slug ?? null,
        repositoryId: item.repositoryId,
        repositoryFullName:
          repositoryById.get(item.repositoryId)?.fullName ?? null,
        filePath: item.filePath,
        citationCount: item._count._all,
        averageScore: item._avg.score,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async listFeedback(params: {
    page: number;
    pageSize: number;
    search?: string;
    workspaceId?: string;
  }) {
    const where: Prisma.AnswerFeedbackWhereInput = {
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      ...(params.search
        ? {
            OR: [
              {
                user: {
                  email: { contains: params.search, mode: 'insensitive' },
                },
              },
              {
                message: {
                  content: { contains: params.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.answerFeedback.count({ where }),
      this.prisma.answerFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
          message: {
            select: { content: true },
          },
        },
      }),
    ]);

    const workspaceIds = [...new Set(items.map((item) => item.workspaceId))];
    const workspaces = workspaceIds.length
      ? await this.prisma.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const workspaceById = new Map(workspaces.map((w) => [w.id, w]));

    return {
      items: items.map((item) => ({
        id: item.id,
        workspaceId: item.workspaceId,
        workspaceName: workspaceById.get(item.workspaceId)?.name ?? null,
        workspaceSlug: workspaceById.get(item.workspaceId)?.slug ?? null,
        conversationId: item.conversationId,
        messageId: item.messageId,
        userId: item.userId,
        userEmail: item.user.email,
        userName: `${item.user.firstName} ${item.user.lastName}`.trim(),
        rating: item.rating,
        messageSnippet:
          item.message.content.length > 180
            ? `${item.message.content.slice(0, 180)}…`
            : item.message.content,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async listTokenUsage(params: {
    page: number;
    pageSize: number;
    search?: string;
    workspaceId?: string;
  }) {
    const search = params.search?.trim();
    const searchUuid = search ? this.asUuidOrUndefined(search) : undefined;

    type TokenUsageRow = {
      workspaceId: string;
      inputTokens: bigint | number | null;
      outputTokens: bigint | number | null;
      totalTokens: bigint | number | null;
      answersWithUsage: bigint | number | null;
      answerCount: bigint | number | null;
    };

    const workspaceFilter = params.workspaceId
      ? Prisma.sql`AND c."workspaceId" = ${params.workspaceId}::uuid`
      : Prisma.empty;

    const searchFilter = search
      ? searchUuid
        ? Prisma.sql`AND (
            w.name ILIKE ${`%${search}%`}
            OR w.slug ILIKE ${`%${search}%`}
            OR c."workspaceId" = ${searchUuid}::uuid
          )`
        : Prisma.sql`AND (
            w.name ILIKE ${`%${search}%`}
            OR w.slug ILIKE ${`%${search}%`}
          )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<TokenUsageRow[]>`
      SELECT
        c."workspaceId" AS "workspaceId",
        COALESCE(SUM(NULLIF(m.metadata->'usage'->>'inputTokens', '')::double precision), 0) AS "inputTokens",
        COALESCE(SUM(NULLIF(m.metadata->'usage'->>'outputTokens', '')::double precision), 0) AS "outputTokens",
        COALESCE(
          SUM(NULLIF(m.metadata->'usage'->>'inputTokens', '')::double precision),
          0
        ) + COALESCE(
          SUM(NULLIF(m.metadata->'usage'->>'outputTokens', '')::double precision),
          0
        ) AS "totalTokens",
        COUNT(*) FILTER (
          WHERE m.metadata->'usage' IS NOT NULL
            AND m.metadata->'usage' <> 'null'::jsonb
        ) AS "answersWithUsage",
        COUNT(*) AS "answerCount"
      FROM messages m
      INNER JOIN conversations c ON c.id = m."conversationId"
      INNER JOIN workspaces w ON w.id = c."workspaceId"
      WHERE m.role = 'ASSISTANT'
        AND c."deletedAt" IS NULL
        ${workspaceFilter}
        ${searchFilter}
      GROUP BY c."workspaceId"
      ORDER BY "totalTokens" DESC, c."workspaceId" ASC
    `;

    const total = rows.length;
    const pageItems = rows.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    );

    const workspaceIds = pageItems.map((row) => row.workspaceId);
    const workspaces = workspaceIds.length
      ? await this.prisma.workspace.findMany({
          where: { id: { in: workspaceIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const workspaceById = new Map(workspaces.map((w) => [w.id, w]));

    return {
      items: pageItems.map((row) => ({
        workspaceId: row.workspaceId,
        workspaceName: workspaceById.get(row.workspaceId)?.name ?? null,
        workspaceSlug: workspaceById.get(row.workspaceId)?.slug ?? null,
        inputTokens: this.toNumber(row.inputTokens),
        outputTokens: this.toNumber(row.outputTokens),
        totalTokens: this.toNumber(row.totalTokens),
        answersWithUsage: this.toNumber(row.answersWithUsage),
        answerCount: this.toNumber(row.answerCount),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  private async getTokenUsageTotals() {
    type TokenTotalsRow = {
      inputTokens: bigint | number | null;
      outputTokens: bigint | number | null;
      answersWithUsage: bigint | number | null;
      answerCount: bigint | number | null;
    };

    const [row] = await this.prisma.$queryRaw<TokenTotalsRow[]>`
      SELECT
        COALESCE(SUM(NULLIF(m.metadata->'usage'->>'inputTokens', '')::double precision), 0) AS "inputTokens",
        COALESCE(SUM(NULLIF(m.metadata->'usage'->>'outputTokens', '')::double precision), 0) AS "outputTokens",
        COUNT(*) FILTER (
          WHERE m.metadata->'usage' IS NOT NULL
            AND m.metadata->'usage' <> 'null'::jsonb
        ) AS "answersWithUsage",
        COUNT(*) AS "answerCount"
      FROM messages m
      INNER JOIN conversations c ON c.id = m."conversationId"
      WHERE m.role = 'ASSISTANT'
        AND c."deletedAt" IS NULL
    `;

    const inputTokens = this.toNumber(row?.inputTokens);
    const outputTokens = this.toNumber(row?.outputTokens);
    const answersWithUsage = this.toNumber(row?.answersWithUsage);
    const answerCount = this.toNumber(row?.answerCount);

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      answersWithUsage,
      answerCount,
      coverageRate: answerCount === 0 ? null : answersWithUsage / answerCount,
    };
  }

  async listActiveUsage(params: {
    page: number;
    pageSize: number;
    days?: number;
  }) {
    const days = Math.min(Math.max(params.days ?? 30, 1), 90);

    type ActiveDayRow = {
      day: Date;
      activeUsers: bigint | number | null;
      questions: bigint | number | null;
    };

    const rows = await this.prisma.$queryRaw<ActiveDayRow[]>`
      WITH days AS (
        SELECT generate_series(
          (date_trunc('day', now() AT TIME ZONE 'utc') - ((${days}::int - 1) * interval '1 day'))::date,
          (date_trunc('day', now() AT TIME ZONE 'utc'))::date,
          interval '1 day'
        )::date AS day
      ),
      activity AS (
        SELECT
          (m."createdAt" AT TIME ZONE 'utc')::date AS day,
          COUNT(DISTINCT c."createdById") AS "activeUsers",
          COUNT(*) AS questions
        FROM messages m
        INNER JOIN conversations c ON c.id = m."conversationId"
        WHERE m.role = 'USER'
          AND c."deletedAt" IS NULL
          AND m."createdAt" >= (
            date_trunc('day', now() AT TIME ZONE 'utc') - ((${days}::int - 1) * interval '1 day')
          ) AT TIME ZONE 'utc'
        GROUP BY 1
      )
      SELECT
        d.day,
        COALESCE(a."activeUsers", 0) AS "activeUsers",
        COALESCE(a.questions, 0) AS questions
      FROM days d
      LEFT JOIN activity a ON a.day = d.day
      ORDER BY d.day DESC
    `;

    const total = rows.length;
    const pageItems = rows.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    );

    return {
      items: pageItems.map((row) => ({
        day: this.toDateString(row.day),
        activeUsers: this.toNumber(row.activeUsers),
        questions: this.toNumber(row.questions),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
      days,
      timezone: 'UTC' as const,
    };
  }

  private async getActiveUsageTotals() {
    type CountRow = { count: bigint | number | null };

    const [dauRows, wauRows] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT c."createdById") AS count
        FROM messages m
        INNER JOIN conversations c ON c.id = m."conversationId"
        WHERE m.role = 'USER'
          AND c."deletedAt" IS NULL
          AND m."createdAt" >= (
            date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
          )
      `,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT c."createdById") AS count
        FROM messages m
        INNER JOIN conversations c ON c.id = m."conversationId"
        WHERE m.role = 'USER'
          AND c."deletedAt" IS NULL
          AND m."createdAt" >= (now() - interval '7 days')
      `,
    ]);

    const dau = this.toNumber(dauRows[0]?.count);
    const wau = this.toNumber(wauRows[0]?.count);

    return {
      dau,
      wau,
      stickiness: wau === 0 ? null : dau / wau,
      timezone: 'UTC' as const,
    };
  }

  private toDateString(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toNumber(value: bigint | number | null | undefined): number {
    if (value == null) {
      return 0;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return Number(value) || 0;
  }

  private asUuidOrUndefined(value: string): string | undefined {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : undefined;
  }
}
