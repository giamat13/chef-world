// Error type for failures the user should see as a readable message (Firestore, token exchange, bad input).
export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}
