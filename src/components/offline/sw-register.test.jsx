import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SwRegister from './sw-register';

const { flushPendingReviews } = vi.hoisted(() => ({ flushPendingReviews: vi.fn() }));
vi.mock('@/lib/offline/sync.js', () => ({ flushPendingReviews }));

describe('SwRegister', () => {
  let register;
  let addEventListener;

  beforeEach(() => {
    flushPendingReviews.mockClear();
    register = vi.fn(async () => ({}));
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });
    addEventListener = vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    delete window.navigator.serviceWorker;
    vi.restoreAllMocks();
  });

  it('registers the service worker', () => {
    render(<SwRegister />);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('renders nothing — it is pure wiring', () => {
    const { container } = render(<SwRegister />);

    expect(container).toBeEmptyDOMElement();
  });

  it('flushes the queue on mount and again whenever the connection returns', () => {
    render(<SwRegister />);

    expect(flushPendingReviews).toHaveBeenCalledTimes(1);

    const onlineHandler = addEventListener.mock.calls.find(([name]) => name === 'online')?.[1];
    onlineHandler?.();

    expect(flushPendingReviews).toHaveBeenCalledTimes(2);
  });

  it('does nothing where the browser has no service worker support', () => {
    delete window.navigator.serviceWorker;

    expect(() => render(<SwRegister />)).not.toThrow();
  });
});
