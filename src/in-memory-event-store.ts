/**
 * Minimal EventStore for Streamable HTTP session resumability (same idea as MCP SDK examples).
 * In-memory only — use for single-node deployments; replace for multi-instance production.
 */
import type { EventStore, StreamId, EventId } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class InMemoryEventStore implements EventStore {
  private events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();

  generateEventId(streamId: StreamId): EventId {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  getStreamIdFromEventId(eventId: EventId): StreamId {
    const parts = eventId.split("_");
    return parts.length > 0 ? parts[0]! : "";
  }

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: EventId,
    {
      send,
    }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> }
  ): Promise<StreamId> {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return "";
    }

    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) {
      return "";
    }

    let foundLast = false;
    const sorted = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [eventId, { streamId: eventStreamId, message }] of sorted) {
      if (eventStreamId !== streamId) continue;
      if (eventId === lastEventId) {
        foundLast = true;
        continue;
      }
      if (foundLast) {
        await send(eventId, message);
      }
    }

    return streamId;
  }
}
