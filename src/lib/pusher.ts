import Pusher from "pusher";
import PusherJS from "pusher-js";

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS:  true,
});

// Client-side singleton
let pusherClient: PusherJS | null = null;

export function getPusherClient(): PusherJS {
  if (pusherClient) return pusherClient;
  pusherClient = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster:      process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: "/api/pusher/auth",
  });
  return pusherClient;
}

// Channel name helpers
export const CHANNELS = {
  workspace: (workspaceId: string) => `workspace-${workspaceId}`,
  conversation: (conversationId: string) => `presence-conv-${conversationId}`,
};

// Event names
export const EVENTS = {
  NEW_MESSAGE:          "new-message",
  MESSAGE_UPDATED:      "message-updated",
  MESSAGE_DELETED:      "message-deleted",
  REACTION_ADDED:       "reaction-added",
  REACTION_REMOVED:     "reaction-removed",
  TYPING_START:         "typing-start",
  TYPING_STOP:          "typing-stop",
  READ_RECEIPT:         "read-receipt",
  CONVERSATION_UPDATED: "conversation-updated",
  NEW_CONVERSATION:     "new-conversation",
  USER_PRESENCE:        "user-presence",
  POLL_VOTE:            "poll-vote",
  AI_SUMMARY_READY:     "ai-summary-ready",
};