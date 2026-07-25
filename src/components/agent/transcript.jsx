/* What has been said, and what state each turn is in.

   State is carried by words and by an ink rule, never by hue — a failed turn
   gets the 2px left border that nothing else in the interface has, and a
   queued one says "waiting" in so many words. */

const STATUS_WORDS = {
  queued: 'Waiting',
  running: 'Working',
  stopped: 'Stopped',
  failed: 'Not sent',
};

export default function Transcript({ messages = [], working = false }) {
  if (messages.length === 0) {
    return (
      <p className="max-w-measure px-4 py-8 text-body">
        Ask about anything you have added. Answers come from your material and
        say which page they came from.
      </p>
    );
  }

  return (
    <ol className="flex max-h-[50vh] flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((message) => {
        const word = STATUS_WORDS[message.status];
        const failed = message.status === 'failed';

        return (
          <li
            key={message.id}
            className={['flex flex-col gap-1', failed ? 'border-l-2 border-l-ink pl-3' : ''].join(
              ' ',
            )}
          >
            <p className="font-mono text-label uppercase">
              {message.role === 'user' ? 'You' : 'wissly'}
              {word ? ` · ${word}` : ''}
            </p>

            {message.content ? (
              <p className="max-w-measure whitespace-pre-wrap text-body">
                {message.content}
              </p>
            ) : (
              <p className="text-body">
                {working ? 'Reading your material.' : 'Nothing came back.'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
