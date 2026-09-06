import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly mailService: MailService) {}

  async submit(dto: CreateContactDto): Promise<{ success: true }> {
    await this.mailService.sendContactInquiry({
      name: dto.name,
      email: dto.email,
      message: dto.message,
    });

    try {
      await this.mailService.sendContactAcknowledgement({
        name: dto.name,
        email: dto.email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send contact acknowledgement to ${dto.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return { success: true };
  }
}
