export class OverviewValidationError extends Error {
  readonly publicMessage: string;

  constructor(publicMessage: string) {
    super(publicMessage);
    this.name = 'OverviewValidationError';
    this.publicMessage = publicMessage;
  }
}
