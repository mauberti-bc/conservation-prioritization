export class PrefectSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrefectSubmissionError';
  }
}
