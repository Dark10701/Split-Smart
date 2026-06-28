/** Abstraction for delivering a group invite out-of-band (email). */
export interface InviteNotifier {
  sendInvite(input: { email: string; token: string; groupId: string }): Promise<void>;
}

/** DI token for the InviteNotifier. */
export const INVITE_NOTIFIER = Symbol('INVITE_NOTIFIER');
