import { SystemLogCategory, SystemLogLevel } from '@prisma/client';
import { SystemLogsRepository } from './system-logs.repository';
import { SystemLogsService } from './system-logs.service';

describe('SystemLogsService', () => {
  let repository: jest.Mocked<Pick<SystemLogsRepository, 'create'>>;
  let service: SystemLogsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
    };
    service = new SystemLogsService(
      repository as unknown as SystemLogsRepository,
    );
  });

  it('does not throw when repository create fails', async () => {
    repository.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.recordAsync({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.INFO,
        event: 'admin.auth.signin.success',
        metadata: { email: 'admin@architect.ai', password: 'secret' },
      }),
    ).resolves.toBeNull();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.auth.signin.success',
        metadata: { email: 'admin@architect.ai' },
      }),
    );
  });

  it('maps status codes to levels', () => {
    expect(service.levelFromStatusCode(200)).toBe(SystemLogLevel.INFO);
    expect(service.levelFromStatusCode(404)).toBe(SystemLogLevel.WARN);
    expect(service.levelFromStatusCode(500)).toBe(SystemLogLevel.ERROR);
  });
});
