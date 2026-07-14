import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/** Events pushed to a group's room. Clients invalidate their caches on receipt. */
export type RealtimeEvent =
  | { type: 'expense.created'; expenseId: string }
  | { type: 'expense.updated'; expenseId: string }
  | { type: 'expense.deleted'; expenseId: string }
  | { type: 'balances.updated' };

const groupRoom = (groupId: string): string => `group:${groupId}`;

/**
 * Realtime fan-out for balance/feed updates (M2-18).
 *
 * Membership authorization is enforced at the REST layer; a socket joins a
 * group room only after the client has been served that group's data. The
 * gateway itself is transport-only — it holds no business logic.
 */
@WebSocketGateway({ cors: { origin: true }, path: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Realtime client connected: ${client.id}`);
  }

  /** A client subscribes to a group it can already see over REST. */
  @SubscribeMessage('group.subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { groupId?: string },
  ): { ok: boolean } {
    if (!body?.groupId) return { ok: false };
    void client.join(groupRoom(body.groupId));
    return { ok: true };
  }

  @SubscribeMessage('group.unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { groupId?: string },
  ): { ok: boolean } {
    if (!body?.groupId) return { ok: false };
    void client.leave(groupRoom(body.groupId));
    return { ok: true };
  }

  /** Emit an event to every socket subscribed to the group. */
  emitToGroup(groupId: string, event: RealtimeEvent): void {
    // `server` is undefined only if the gateway hasn't initialized (e.g. in unit
    // tests that construct it directly); guard so publishing never throws.
    this.server?.to(groupRoom(groupId)).emit('group.event', event);
  }
}
