import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Payment } from '@prisma/client';
import { createPaymentIntentSchema } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMembershipGuard } from '../groups/group-membership.guard';
import { CurrentMembership, type Membership } from '../groups/membership.decorator';
import { PaymentsService, type IntentResult } from './payments.service';

type Validatable<T> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
};

function validate<T>(schema: Validatable<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('groups/:id/payments/intent')
  @UseGuards(JwtAuthGuard, GroupMembershipGuard)
  async createIntent(
    @Param('id') groupId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<IntentResult> {
    const input = validate(createPaymentIntentSchema, body);
    return this.payments.createIntent(groupId, membership.userId, input);
  }

  @Get('groups/:id/payments/:paymentId')
  @UseGuards(JwtAuthGuard, GroupMembershipGuard)
  async detail(
    @Param('id') groupId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<Payment> {
    return this.payments.getById(groupId, paymentId);
  }

  /**
   * Provider webhook (M4-05). Unauthenticated by design — authenticity comes
   * from the provider signature, verified inside the service. Uses the raw body
   * captured by the body-parser verify hook so signatures stay valid.
   */
  @Post('payments/webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: string },
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ handled: boolean }> {
    const raw = req.rawBody ?? (typeof body === 'string' ? body : JSON.stringify(body));
    return this.payments.handleWebhook(raw, signature);
  }
}
