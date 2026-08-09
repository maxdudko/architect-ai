import { Injectable } from '@nestjs/common';
import { Admin, Prisma } from '@prisma/client';
import { AdminsRepository } from './admins.repository';

@Injectable()
export class AdminsService {
  constructor(private readonly adminsRepository: AdminsRepository) {}

  findByEmail(email: string): Promise<Admin | null> {
    return this.adminsRepository.findByEmail(email);
  }

  findById(id: string): Promise<Admin | null> {
    return this.adminsRepository.findById(id);
  }

  touchLastLoginAt(adminId: string): Promise<Admin> {
    return this.adminsRepository.touchLastLoginAt(adminId);
  }

  create(data: Prisma.AdminCreateInput): Promise<Admin> {
    return this.adminsRepository.create(data);
  }
}
