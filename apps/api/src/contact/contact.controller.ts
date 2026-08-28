import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 5, windowMs: 15 * 60_000 })
  @ApiOperation({ summary: 'Send a contact form message' })
  submit(@Body() dto: CreateContactDto): Promise<{ success: true }> {
    return this.contactService.submit(dto);
  }
}
