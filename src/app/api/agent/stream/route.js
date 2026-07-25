import { resolveModel } from '@/lib/agent/models.js'
import { runTurn } from '@/lib/agent/run.js'
import { resumeThreadAction, sendMessageAction } from '@/lib/actions/conversation.js'
import { currentUserId } from '@/lib/auth/user.js'
import { runsFor } from '@/lib/data/agent-runs.js'
import {
  appendMessage,
  getConversation,
  messagesFor,
  setConversationMode,
} from '@/lib/data/conversations.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * The turn, over the wire.
 *
 * A server action cannot stream. `sendMessageAction` therefore runs a turn to
 * completion and hands back an answer that arrived all at once, which is the
 * right shape for a form submission and the wrong one for an agent that spends
 * forty seconds reading four sources. This route is the streaming half, and it
 * exists only because of that limit — everything it does that is not streaming
 * is delegated rather than rewritten.
 *
 * **Node, not edge.** The agent SDK wants a full Node runtime, so the default
 * one is stated rather than assumed. Nothing here would survive on edge.
 *
 * **The learner's own client.** `createClient()` builds the request-scoped
 * client from the session cookie, exactly as every server action does. The
 * secret key is not imported here and must not be: `guard.js` refuses a
 * privileged client at the tool boundary, and a route that worked around that
 * would be handing a prompt injection in an uploaded PDF the run of the
 * database.
 *
 * **The browser leaving costs nothing.** Every delta is written to the message
 * row by `runTurn` as it arrives, so the stream is a convenience over the top
 * of storage rather than the place the answer lives. A closed laptop leaves the
 * run going; the bar reconnects with `GET` below, or with `resumeThreadAction`.
 * That is why nothing here listens to `request.signal`.
 */

export const runtime = 'nodejs'

/** A queue that refills itself is a bill rather than a conversation. */
const MAX_DRAIN = 10

/** How often a reconnecting client asks the row what it says now. */
const RESUME_POLL_MS = 250

/** How long a reconnected stream follows a run before letting the client ask again. */
const RESUME_LIMIT_MS = 5 * 60 * 1000

const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  // Nginx and friends buffer a response body by default, which turns a stream
  // back into a single late payload.
  'x-accel-buffering': 'no',
}

function json(body, status = 200) {
  return Response.json(body, { status })
}

/** One event, in the wire format `EventSource` reads. */
function frame(event) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * Send a message and stream the answer.
 *
 * Body: `{ conversationId, content, mode?, model? }`.
 *
 * Answers `text/event-stream` when the turn starts here, and
 * `application/json` when it does not — 401 with no session, 400 on anything
 * the learner can correct, 202 when the message went into the queue instead.
 */
export async function POST(request) {
  const supabase = await createClient()

  // `currentUserId` rather than `requireUserId`: this is not a page, and a
  // redirect to the sign-in screen is not something `EventSource` can follow.
  const userId = await currentUserId(supabase)
  if (!userId) return json({ error: 'Sign in first.' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'That was not a message.' }, 400)
  }

  const { conversationId, mode, model } = body ?? {}
  const content = String(body?.content ?? '').trim()

  if (!conversationId) return json({ error: 'Say which conversation.' }, 400)
  if (content === '') return json({ error: 'Write something first.' }, 400)

  // Before any row exists. A model id the learner mistyped is theirs to
  // correct, not a failed turn to read about in the thread afterwards.
  let chosen = null
  if (model) {
    try {
      chosen = resolveModel({ chosen: model })
    } catch (error) {
      return json({ error: error.message }, 400)
    }
  }

  try {
    const conversation = await getConversation(supabase, { id: conversationId })
    if (!conversation) return json({ error: 'That conversation is no longer there.' }, 404)

    const existing = await messagesFor(supabase, { conversationId })
    const busy = existing.some((message) => ['running', 'queued'].includes(message.status))

    // The queue is not reimplemented here. `sendMessageAction` already decides
    // this the same way, writes the message `queued` and returns without
    // running anything — which is exactly what a busy thread needs, and it
    // needs it in JSON, because there is no stream to join.
    if (busy) {
      const queued = await sendMessageAction({ conversationId, content, mode, model })
      if (queued.error) return json({ error: queued.error }, 400)

      return json({ queued: true, message: queued.message }, 202)
    }

    if (mode && mode !== conversation.mode) {
      await setConversationMode(supabase, { id: conversationId, mode })
      conversation.mode = mode
    }

    const stored = await appendMessage(supabase, {
      userId,
      conversationId,
      role: 'user',
      content,
      mode: conversation.mode,
      model: chosen,
      busy: false,
    })

    // Stop is pressed in a different request, so the turn cannot be told — it
    // has to look. Anything stopped after this instant belongs to this turn;
    // an older stopped message in the same thread does not.
    const since = Date.now() - 1000
    const shouldStop = async () => {
      try {
        const messages = await messagesFor(supabase, { conversationId })
        return messages.some(
          (message) =>
            message.status === 'stopped' &&
            new Date(message.created_at ?? 0).getTime() >= since,
        )
      } catch {
        // A failed lookup is not a stop. Guessing yes would end a turn the
        // learner is paying for over a dropped query.
        return false
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const send = (event) => {
          try {
            controller.enqueue(encoder.encode(frame(event)))
          } catch {
            /* The client left. The run carries on writing to its row. */
          }
        }

        send({ type: 'start', conversationId, message: stored })

        try {
          let turn = await runTurn({
            supabase,
            userId,
            conversation,
            message: stored,
            onEvent: send,
            shouldStop,
          })

          // Drain what arrived while this turn was running, on the same
          // stream, so a learner who typed twice watches both answers.
          for (let drained = 0; turn.next && drained < MAX_DRAIN; drained += 1) {
            turn = await runTurn({
              supabase,
              userId,
              conversation,
              message: turn.next,
              onEvent: send,
              shouldStop,
            })
          }
        } catch (error) {
          // `runTurn` reports its own failures in the thread and returns. This
          // catches the ones it could not — a dead database, a thrown insert —
          // where nothing was written and the bar would otherwise wait forever.
          send({ type: 'failed', content: error?.message ?? String(error), completed: [] })
        }

        try {
          controller.close()
        } catch {
          /* Already gone. */
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch (error) {
    return json({ error: error.message }, 500)
  }
}

/**
 * The run writing one message, by name.
 *
 * A failure here is not a failure to reconnect. The stream's job is to show the
 * learner the answer arriving; losing the undo is worse than losing the read,
 * but refusing the read to protect the undo would be worse than both.
 */
async function runOf(supabase, { conversationId, messageId }) {
  try {
    const runs = await runsFor(supabase, { conversationId })
    return runs.find((run) => run.message_id === messageId)?.id ?? null
  } catch {
    return null
  }
}

/**
 * Reconnect to a run already in flight.
 *
 * `GET /api/agent/stream?conversationId=…`
 *
 * The message row is the source of truth, so this needs nothing from the
 * request that started the run — a different process, a different machine or a
 * different day would answer identically. It replays what has been persisted
 * as a `resume` frame, then follows the row until it settles.
 *
 * Nothing running is not an error. It is the ordinary answer to "what is the
 * state of this thread", and it comes back as JSON so the bar can render the
 * settled transcript without parsing a stream to learn there was nothing in it.
 */
export async function GET(request) {
  const supabase = await createClient()

  const userId = await currentUserId(supabase)
  if (!userId) return json({ error: 'Sign in first.' }, 401)

  const conversationId = new URL(request.url).searchParams.get('conversationId')
  if (!conversationId) return json({ error: 'Say which conversation.' }, 400)

  const state = await resumeThreadAction({ conversationId })
  if (state.error) return json({ error: state.error }, 500)

  if (!state.running) {
    return json({ running: null, messages: state.messages, queued: state.queued })
  }

  // Which run is writing that row. A reconnecting client did not start this
  // run and has no other way to learn its name, and a client that cannot name
  // the run it rejoined cannot take it back — a reload would quietly cost the
  // learner the undo on the very turn they came back to watch. The run row
  // already carries `message_id`, so this is a read rather than a new column.
  const runId = await runOf(supabase, { conversationId, messageId: state.running.id })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let open = true

      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(frame(event)))
        } catch {
          open = false
        }
      }

      send({
        type: 'resume',
        conversationId,
        runId,
        message: state.running,
        messages: state.messages,
        queued: state.queued,
      })

      let seen = String(state.running.content ?? '')
      const deadline = Date.now() + RESUME_LIMIT_MS

      try {
        while (open && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, RESUME_POLL_MS))

          const messages = await messagesFor(supabase, { conversationId })
          const row = messages.find((message) => message.id === state.running.id)

          if (!row) break

          const content = String(row.content ?? '')
          if (content.length > seen.length && content.startsWith(seen)) {
            send({ type: 'delta', text: content.slice(seen.length) })
            seen = content
          } else if (content !== seen) {
            // The row was rewritten rather than appended to — a failure
            // message replacing a part-written answer. Say the whole thing.
            send({ type: 'delta', text: content })
            seen = content
          }

          if (row.status !== 'running') {
            send({
              type: row.status === 'done' ? 'done' : row.status,
              content,
              completed: [],
              runId,
            })
            break
          }
        }
      } catch (error) {
        send({ type: 'failed', content: error?.message ?? String(error), completed: [] })
      }

      try {
        controller.close()
      } catch {
        /* Already gone. */
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
