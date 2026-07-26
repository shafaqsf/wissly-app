'use client';

import { Mic, MicOff, Volume2 } from 'lucide-react';

/* Voice mode's one control on the bar, and the mic that appears beside it.
 *
 * `support` says which half of the Web Speech API this browser actually
 * ships — see `src/lib/agent/voice.js`, which is where that is worked out,
 * never here. A browser with neither half renders nothing: a button for an
 * API that is not there is worse than no button, because pressing it would
 * do nothing and say nothing about why.
 *
 * Voice and listening are two different states on purpose. Voice mode can be
 * on while the bar is quiet — the learner has not pressed the mic yet, or the
 * agent is mid-answer and about to be read aloud — so a single toggle would
 * conflate "the feature is on" with "the microphone is live", which are not
 * the same fact and must not share one control. */

export default function VoiceToggle({
  support = { input: false, output: false },
  voiceOn = false,
  listening = false,
  onToggleVoice,
  onToggleListening,
}) {
  if (!support.input && !support.output) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onToggleVoice?.(!voiceOn)}
        aria-pressed={voiceOn}
        aria-label={voiceOn ? 'Turn voice mode off' : 'Turn voice mode on'}
        title={
          voiceOn
            ? 'Voice mode is on: replies are read aloud.'
            : 'Speak to the agent and hear its replies.'
        }
        className="motion-lift flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
      >
        <Volume2 size={16} strokeWidth={1.5} aria-hidden="true" />
        Voice
      </button>

      {voiceOn && support.input ? (
        <button
          type="button"
          onClick={() => onToggleListening?.(!listening)}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Speak your question'}
          className="motion-lift flex size-11 shrink-0 items-center justify-center rounded-control border border-rule"
        >
          {listening ? (
            <MicOff size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Mic size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      ) : null}
    </div>
  );
}
