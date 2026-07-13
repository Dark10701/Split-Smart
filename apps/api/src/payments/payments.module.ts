import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { BalancesModule } from '../balances/balances.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './payment-provider';
import { StubPaymentProvider } from './stub-payment-provider';

@Module({
  imports: [AuthModule, UsersModule, GroupsModule, BalancesModule],
  providers: [
    PaymentsService,
    // Default in-repo provider; the Stripe adapter replaces this binding once
    // STRIPE_SECRET_KEY is provisioned (M4-01).
    { provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider },
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
