'use client';

import { useState } from 'react';

import AgentBar from '@/components/agent/agent-bar';
import {
  newThreadAction,
  openThreadAction,
  sendMessageAction,
  stopThreadAction,
} from '@/lib/actions/conversation';

/* The bar's state, kept out of the bar itself.
   `AgentBar` renders a conversation; this decides which conversation that is
   and what happens when the learner sends something. Splitting them is what
   lets the bar be tested without a database and without a server action. */

export default function AgentDock({ conversation: initial = null, messages: initialMessages = [] }) {
  const [conversation, setConversation] = useState(initial);
  const [messages, setMessages] = useState(initialMessages);
  const [working, setWorking] = useState(false);

  async function send({ content, mode }) {
    let thread = conversation;

    if (!thread) {
      const created = await newThreadAction({ mode });
      if (created.error) return created;
      thread = created.conversation;
      setConversation(thread);
    }

    // On the screen before the server has seen it. The id is replaced when
    // the real row comes back; until then the learner reads their own words
    // rather than an empty panel.
    const pending = {
      id: `pending-${messages.length}`,
      role: 'user',
      content,
      status: working ? 'queued' : 'running',
    };
    setMessages((current) => [...current, pending]);

    if (working) {
      await sendMessageAction({ conversationId: thread.id, content, mode });
      return refresh(thread.id);
    }

    setWorking(true);

    try {
      const result = await sendMessageAction({
        conversationId: thread.id,
        content,
        mode,
      });

      if (result.error) return result;
      return await refresh(thread.id);
    } finally {
      setWorking(false);
    }
  }

  async function refresh(id) {
    const opened = await openThreadAction({ id });
    if (opened.error) return opened;

    setConversation(opened.conversation);
    setMessages(opened.messages);
    return {};
  }

  async function stop() {
    if (!conversation) return;
    await stopThreadAction({ conversationId: conversation.id });
    setWorking(false);
    await refresh(conversation.id);
  }

  return (
    <AgentBar
      messages={messages}
      mode={conversation?.mode ?? 'chat'}
      working={working}
      onSend={send}
      onStop={stop}
    />
  );
}
