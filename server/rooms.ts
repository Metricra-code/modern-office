import { LIMITS } from '../src/lib/limits';
import type { ChatMessage, Channel, Player, PresenceStatus, Profile } from '../src/lib/protocol';
import { findOpenSpot, isWalkable, type Point } from '../src/lib/space';

const LOBBY: Point = { x: 450, y: 315 };
export interface WorkspaceSnapshot {
  players: Player[];
  messages: ChatMessage[];
}

interface Workspace {
  players: Map<string, Player>;
  messages: ChatMessage[];
}
export class OfficeRooms {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly membership = new Map<string, string>();

  join(workspaceId: string, profile: Profile): Player {
    const workspace = this.workspaces.get(workspaceId) ?? { players: new Map(), messages: [] };
    if (
      workspace.players.size >= LIMITS.guestsPerWorkspace ||
      this.membership.size >= LIMITS.guestsTotal
    )
      throw new Error('Workspace is full');
    if (!this.workspaces.has(workspaceId) && this.workspaces.size >= LIMITS.workspaces)
      throw new Error('Server is full');
    const spawn = findOpenSpot([...workspace.players.values()], LOBBY);
    if (!spawn) throw new Error('No open guest position');
    const player: Player = { ...profile, id: crypto.randomUUID(), ...spawn, status: 'available' };
    workspace.players.set(player.id, player);
    this.workspaces.set(workspaceId, workspace);
    this.membership.set(player.id, workspaceId);
    return player;
  }

  restore(workspaceId: string, snapshot: WorkspaceSnapshot): void {
    const previous = this.workspaces.get(workspaceId);
    if (!previous && snapshot.players.length > 0 && this.workspaces.size >= LIMITS.workspaces)
      throw new Error('Restored server is full');
    if (
      snapshot.players.length > LIMITS.guestsPerWorkspace ||
      this.membership.size - (previous?.players.size ?? 0) + snapshot.players.length >
        LIMITS.guestsTotal
    )
      throw new Error('Restored workspace is full');
    if (
      snapshot.players.some(
        (player) =>
          this.membership.has(player.id) && this.membership.get(player.id) !== workspaceId,
      )
    )
      throw new Error('Guest belongs to another workspace');
    if (new Set(snapshot.players.map((player) => player.id)).size !== snapshot.players.length)
      throw new Error('Duplicate restored guest');
    for (const player of previous?.players.values() ?? []) this.membership.delete(player.id);
    for (const player of snapshot.players) this.membership.set(player.id, workspaceId);
    if (snapshot.players.length === 0) {
      this.workspaces.delete(workspaceId);
      return;
    }
    this.workspaces.set(workspaceId, {
      players: new Map(snapshot.players.map((player) => [player.id, { ...player }])),
      messages: snapshot.messages.slice(-LIMITS.history).map((message) => ({ ...message })),
    });
  }

  snapshot(workspaceId: string): WorkspaceSnapshot {
    const workspace = this.workspaces.get(workspaceId);
    return {
      players: [...(workspace?.players.values() ?? [])],
      messages: [...(workspace?.messages ?? [])],
    };
  }

  workspaceOf(id: string): string {
    const workspaceId = this.membership.get(id);
    if (!workspaceId) throw new Error('Guest is no longer connected');
    return workspaceId;
  }

  private getPlayer(id: string): { workspace: Workspace; player: Player } {
    const workspace = this.workspaces.get(this.workspaceOf(id));
    const player = workspace?.players.get(id);
    if (!workspace || !player) throw new Error('Guest is no longer connected');
    return { workspace, player };
  }

  move(id: string, point: Point): void {
    if (!isWalkable(point)) throw new Error('Choose a spot inside the office, away from walls');
    const { workspace, player } = this.getPlayer(id);
    workspace.players.set(id, { ...player, x: point.x, y: point.y });
  }

  profile(id: string, profile: Profile): void {
    const { workspace, player } = this.getPlayer(id);
    workspace.players.set(id, { ...player, name: profile.name, color: profile.color });
  }

  status(id: string, status: PresenceStatus): void {
    const { workspace, player } = this.getPlayer(id);
    workspace.players.set(id, { ...player, status });
  }

  chat(id: string, input: { text: string; channel: Channel }): ChatMessage {
    const { workspace, player } = this.getPlayer(id);
    const message: ChatMessage = {
      text: input.text,
      channel: input.channel,
      id: crypto.randomUUID(),
      senderId: id,
      name: player.name,
      color: player.color,
      sentAt: Date.now(),
    };
    workspace.messages = [...workspace.messages, message].slice(-LIMITS.history);
    return message;
  }

  canSignal(from: string, target: string): boolean {
    return (
      from !== target &&
      this.membership.has(from) &&
      this.membership.get(from) === this.membership.get(target)
    );
  }

  leave(id: string): string | undefined {
    const workspaceId = this.membership.get(id);
    if (!workspaceId) return;
    const workspace = this.workspaces.get(workspaceId);
    workspace?.players.delete(id);
    this.membership.delete(id);
    if (workspace?.players.size === 0) this.workspaces.delete(workspaceId);
    return workspaceId;
  }
}
