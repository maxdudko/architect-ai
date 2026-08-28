import { MailService } from '../mail/mail.service';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  const dto = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'Tell me about Architect AI.',
  };

  let mailService: {
    sendContactInquiry: jest.Mock;
    sendContactAcknowledgement: jest.Mock;
  };
  let service: ContactService;

  beforeEach(() => {
    mailService = {
      sendContactInquiry: jest.fn().mockResolvedValue(undefined),
      sendContactAcknowledgement: jest.fn().mockResolvedValue(undefined),
    };
    service = new ContactService(mailService as unknown as MailService);
  });

  it('sends the inquiry then the acknowledgement', async () => {
    await expect(service.submit(dto)).resolves.toEqual({ success: true });

    expect(mailService.sendContactInquiry).toHaveBeenCalledWith(dto);
    expect(mailService.sendContactAcknowledgement).toHaveBeenCalledWith({
      name: dto.name,
      email: dto.email,
    });
    expect(
      mailService.sendContactInquiry.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mailService.sendContactAcknowledgement.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('still succeeds when acknowledgement fails after the inquiry is sent', async () => {
    mailService.sendContactAcknowledgement.mockRejectedValue(
      new Error('acknowledgement failed'),
    );

    await expect(service.submit(dto)).resolves.toEqual({ success: true });
    expect(mailService.sendContactInquiry).toHaveBeenCalledTimes(1);
    expect(mailService.sendContactAcknowledgement).toHaveBeenCalledTimes(1);
  });

  it('does not send an acknowledgement when the inquiry fails', async () => {
    mailService.sendContactInquiry.mockRejectedValue(
      new Error('inquiry failed'),
    );

    await expect(service.submit(dto)).rejects.toThrow('inquiry failed');
    expect(mailService.sendContactAcknowledgement).not.toHaveBeenCalled();
  });
});
