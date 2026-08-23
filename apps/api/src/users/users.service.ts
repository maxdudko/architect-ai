import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.usersRepository.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  touchLastLoginAt(userId: string): Promise<User> {
    return this.usersRepository.touchLastLoginAt(userId);
  }

  update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.usersRepository.update(userId, data);
  }

  softDelete(userId: string): Promise<User> {
    return this.usersRepository.softDelete(userId);
  }

  restore(userId: string): Promise<User> {
    return this.usersRepository.restore(userId);
  }

  findManyPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    includeDeleted?: boolean;
  }): Promise<{ items: User[]; total: number }> {
    return this.usersRepository.findManyPaginated(params);
  }
}
