import { describe, expect, it } from 'vitest';

import { describeAction, destinationOf } from './activity';

describe('what the agent did, in words', () => {
  it('says what was made, and of what type', () => {
    expect(
      describeAction({
        tool: 'make_artefacts',
        args: { count: 4, format: 'flashcard' },
      }),
    ).toBe('Made 4 flashcards from your material');
  });

  it('counts one in the singular', () => {
    expect(
      describeAction({ tool: 'make_artefacts', args: { count: 1, format: 'cloze' } }),
    ).toBe('Made 1 cloze from your material');
  });

  it('never says "artefact", even when the format is unknown', () => {
    const sentence = describeAction({
      tool: 'make_artefacts',
      args: { count: 3, format: null },
    });

    expect(sentence).toBe('Made 3 tasks from your material');
    expect(sentence).not.toMatch(/artefact/i);
  });

  it('says a course was renamed, and to what', () => {
    expect(
      describeAction({ tool: 'rename_course', args: { title: 'Analysis I' } }),
    ).toBe('Renamed a course to “Analysis I”');
  });

  it('falls back to the tool name rather than inventing a sentence', () => {
    expect(describeAction({ tool: 'something_new', args: {} })).toBe('something_new');
  });
});

describe('where the change landed', () => {
  it('sends a generation to the workbench', () => {
    expect(destinationOf({ tool: 'make_artefacts', args: {} })).toBe('/tasks');
  });

  it('sends a rename to the course it renamed', () => {
    expect(destinationOf({ tool: 'rename_course', args: { courseId: 's1' } })).toBe(
      '/courses/s1',
    );
  });

  it('sends anything else to the courses shelf', () => {
    expect(destinationOf({ tool: 'something_new', args: {} })).toBe('/courses');
  });
});
