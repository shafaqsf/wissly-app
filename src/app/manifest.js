import { MARK } from '@/components/brand/brand-mark';

/* Installable, so the review queue is a shortcut a learner can open straight
 * into rather than a browser tab they have to find again — see docs/DESIGN.md
 * for why the colours below are ink and paper, not a "brand" palette. */
export default function manifest() {
  return {
    name: 'wissly',
    short_name: 'wissly',
    description: 'An open source agentic learning platform.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [{ src: MARK, sizes: 'any', type: 'image/png' }],
  };
}
