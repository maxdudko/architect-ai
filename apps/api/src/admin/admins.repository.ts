import { Injectable } from '@nestjs/common';
import { Admin, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({
      where: { email },
    });
  }

  findById(id: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({
      where: { id },
    });
  }

  touchLastLoginAt(id: string): Promise<Admin> {
    return this.prisma.admin.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  create(data: Prisma.AdminCreateInput): Promise<Admin> {
    return this.prisma.admin.create({ data });
  }
}
