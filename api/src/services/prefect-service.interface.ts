/**
 * Result of a Prefect state transition, including orchestration rejection.
 */
export interface PrefectStateTransitionResponse {
  status: 'ACCEPT' | 'REJECT' | 'ABORT' | 'WAIT';
  state?: { type: string } | null;
}
