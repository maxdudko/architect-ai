/**
 * DI token for the Stripe SDK instance, kept in its own module-free file so
 * consumers that only need the token (e.g. `BillingService`'s `@Inject`) don't
 * have to pull in the `stripe` package as a runtime dependency.
 */
export const STRIPE_CLIENT = 'STRIPE_CLIENT';
