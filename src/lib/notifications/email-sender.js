/**
 * The boundary between "an email's content has been decided" and "an email
 * left this process". Everything on this file's side of that line is real
 * and unit-tested; nothing past it talks to a network.
 *
 * @typedef {object} EmailMessage
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 * @property {string} [html]
 *
 * @typedef {object} EmailSendResult
 * @property {boolean} delivered
 * @property {string|null} id
 *
 * @typedef {object} EmailSender
 * @property {(message: EmailMessage) => Promise<EmailSendResult>} send
 */

/**
 * The only `EmailSender` this codebase wires up. It does not call Resend,
 * SendGrid, Postmark or SMTP — deliberately: the task this shipped under
 * forbids wiring a real third-party account here. It writes what would have
 * been sent to the server log and reports `delivered: false`, so nothing
 * downstream can mistake a console line for a delivered email.
 *
 * Swapping in a real provider is meant to be a one-file change: implement
 * `EmailSender` (a class or a plain object with a `send` method) against
 * Resend or whichever provider is chosen, and change what `defaultEmailSender`
 * below returns. Nothing that calls a sender needs to change, because
 * everything upstream — `buildWeeklyReport`, `emailFromReport`,
 * `sendWeeklyReport` — depends only on the `EmailSender` shape, never on this
 * class.
 *
 * @implements {EmailSender}
 */
export class ConsoleEmailSender {
  async send({ to, subject, text }) {
    console.log(`[email:stub] would send to=${to} subject=${JSON.stringify(subject)}\n${text}`)
    return { delivered: false, id: null }
  }
}

/** The sender the app uses until a real provider is chosen and wired up here. */
export function defaultEmailSender() {
  return new ConsoleEmailSender()
}
