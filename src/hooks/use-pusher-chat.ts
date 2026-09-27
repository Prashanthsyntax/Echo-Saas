/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import type { Channel } from "pusher-js";

export interface ChatMessage {
  id:             string;
  content:        string;
  type:           string;
  senderId:       string;
  conversationId: string;
  parentId:       string | null;
  isEdited:       boolean;
  isDeleted:      boolean;
  metadata:       any;
  createdAt:      string;
  sender:         { id: string; name: string | null; email: string; imageUrl: string | null };
  reactions:      { emoji: string; user: { id: string; name: string | null } }[];
  attachments:    { id: string; name: string; url: string; size: number; mimeType: string }[];
  readReceipts:   { userId: string; readAt: string; user: { id: string; name: string | null; imageUrl: string | null } }[];
  mentions:       { user: { id: string; name: string | null } }[];
  poll?:          any;
  replies?:       ChatMessage[];
  _count?:        { replies: number };
}

export interface TypingUser {
  userId:   string;
  userName: string;
  imageUrl: string | null;
}

export function usePusherChat(
  conversationId: string | null,
  workspaceId:    string | null,
  currentUserId:  string | null,
  onNewConversation?: (conv: any) => void,
) {
  const convChannelRef  = useRef<Channel | null>(null);
  const wsChannelRef    = useRef<Channel | null>(null);
  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages,        setMessages       ] = useState<ChatMessage[]>([]);
  const [typingUsers,     setTypingUsers    ] = useState<TypingUser[]>([]);
  const [onlineUserIds,   setOnlineUserIds  ] = useState<Set<string>>(new Set());
  const [aiSummary,       setAISummary      ] = useState<string | null>(null);

  // ── conversation channel ──────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const pusher = getPusherClient();

    const channel = pusher.subscribe(CHANNELS.conversation(conversationId));
    convChannelRef.current = channel;

    channel.bind(EVENTS.NEW_MESSAGE, (data: { message: ChatMessage }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    });

    channel.bind(EVENTS.MESSAGE_UPDATED, (data: { message: ChatMessage }) => {
      setMessages(prev =>
        prev.map(m => m.id === data.message.id ? { ...m, ...data.message } : m)
      );
    });

    channel.bind(EVENTS.MESSAGE_DELETED, (data: { messageId: string }) => {
      setMessages(prev =>
        prev.map(m => m.id === data.messageId
          ? { ...m, isDeleted: true, content: "This message was deleted" }
          : m
        )
      );
    });

    channel.bind(EVENTS.REACTION_ADDED, (data: {
      messageId: string; emoji: string; userId: string; userName: string;
    }) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== data.messageId) return m;
          const already = m.reactions.some(
            r => r.emoji === data.emoji && r.user.id === data.userId
          );
          if (already) return m;
          return {
            ...m,
            reactions: [...m.reactions, {
              emoji: data.emoji,
              user:  { id: data.userId, name: data.userName },
            }],
          };
        })
      );
    });

    channel.bind(EVENTS.REACTION_REMOVED, (data: {
      messageId: string; emoji: string; userId: string;
    }) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== data.messageId) return m;
          return {
            ...m,
            reactions: m.reactions.filter(
              r => !(r.emoji === data.emoji && r.user.id === data.userId)
            ),
          };
        })
      );
    });

    channel.bind(EVENTS.TYPING_START, (data: TypingUser) => {
      if (data.userId === currentUserId) return;
      setTypingUsers(prev => {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, data];
      });
    });

    channel.bind(EVENTS.TYPING_STOP, (data: { userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    channel.bind(EVENTS.READ_RECEIPT, (data: {
      messageId: string; userId: string; readAt: string;
    }) => {
      if (data.userId === currentUserId) return;
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== data.messageId) return m;
          if (m.readReceipts.some(r => r.userId === data.userId)) return m;
          return {
            ...m,
            readReceipts: [...m.readReceipts, {
              userId: data.userId, readAt: data.readAt,
              user:   { id: data.userId, name: null, imageUrl: null },
            }],
          };
        })
      );
    });

    channel.bind(EVENTS.POLL_VOTE, (data: { pollId: string; updated: any }) => {
      setMessages(prev =>
        prev.map(m =>
          m.poll?.id === data.pollId ? { ...m, poll: data.updated } : m
        )
      );
    });

    channel.bind(EVENTS.AI_SUMMARY_READY, (data: { summary: string }) => {
      setAISummary(data.summary);
    });

    // presence
    channel.bind("pusher:subscription_succeeded", (members: any) => {
      const ids = new Set<string>();
      members.each((m: any) => ids.add(m.id));
      setOnlineUserIds(ids);
    });
    channel.bind("pusher:member_added",   (m: any) =>
      setOnlineUserIds(prev => new Set([...prev, m.id]))
    );
    channel.bind("pusher:member_removed", (m: any) =>
      setOnlineUserIds(prev => { const next = new Set(prev); next.delete(m.id); return next; })
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.conversation(conversationId));
      convChannelRef.current = null;
    };
  }, [conversationId, currentUserId]);

  // ── workspace channel (new conversation notifications) ────────────
  useEffect(() => {
    if (!workspaceId) return;
    const pusher  = getPusherClient();
    const channel = pusher.subscribe(CHANNELS.workspace(workspaceId));
    wsChannelRef.current = channel;

    channel.bind(EVENTS.NEW_CONVERSATION, (data: any) => {
      if (data.forUserIds?.includes(currentUserId)) {
        onNewConversation?.(data.conversation);
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.workspace(workspaceId));
      wsChannelRef.current = null;
    };
  }, [workspaceId, currentUserId, onNewConversation]);

  // ── typing indicator ─────────────────────────────────────────────
  const sendTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    await fetch("/api/workspace-chat/typing", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ conversationId, isTyping }),
    });

    if (isTyping) {
      typingTimerRef.current = setTimeout(() => sendTyping(false), 3000);
    }
  }, [conversationId]);

  return {
    messages, setMessages,
    typingUsers, onlineUserIds,
    aiSummary, setAISummary,
    sendTyping,
  };
}