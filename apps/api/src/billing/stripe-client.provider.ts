import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './stripe-client.token';

export { STRIPE_CLIENT };

/**
 * Falls back to a placeholder key outside production so the module can be
 * wired up (and DI can resolve) without live Stripe credentials; actual
 * Stripe calls will fail loudly only when invoked.
 * `assertRequiredProductionEnv` guarantees a real key is set in production.
 */
export const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  useFactory: (configService: ConfigService): Stripe => {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    return new Stripe(
      secretKey && secretKey.trim().length > 0
        ? secretKey
        : 'sk_test_unconfigured',
      {
        typescript: true,
      },
    );
  },
  inject: [ConfigService],
};
