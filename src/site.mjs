// Site-wide configuration. Everything that changes per environment lives here.
export const site = {
  name: 'MiniGames.website',
  shortName: 'MiniGames',
  url: 'https://minigames.website', // no trailing slash
  lang: 'en',
  tagline: 'Free online mini games. No download, no sign-up.',
  email: 'hello@minigames.website',
  // Set to 'ca-pub-XXXXXXXXXXXXXXXX' after AdSense approval. While empty, no ad code
  // or ad slots are rendered at all (pages stay clean for the review).
  adsenseClient: '',
  // Ad unit slot ids from AdSense (Ads > By ad unit). Only used when adsenseClient is set.
  adSlots: {
    home: '',
    category: '',
    gameContent: '',
    gameBottom: '',
  },
  // Category pages with fewer games than this are rendered with noindex (thin content).
  minIndexableCategory: 3,
  // Categories appear in the chip bar and footer once they have at least this many games.
  minNavCategory: 2,
  // Homepage switches from one "All games" grid to per-category rows at this size.
  sectionedHomeAt: 12,
};

// Categories, in the order they appear in the chip bar.
// `color` tints chips and tile accents; `icon` is a small inline SVG path (24x24 box).
export const categories = [
  {
    slug: 'arcade', name: 'Arcade', color: '#FF5A4F',
    icon: 'M7 3h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-1l-2 4h-4l-2-4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm1 5v2H6v2h2v2h2v-2h2v-2h-2V8H8Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-2 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    intro: 'Fast, reflex-based games you can pick up in seconds. Arcade games reward quick reactions and a steady hand, and most rounds last only a minute or two, so they are perfect for a short break.',
  },
  {
    slug: 'puzzle', name: 'Puzzle', color: '#3D7BFF',
    icon: 'M9 3h4v2.5a1.5 1.5 0 0 0 3 0V3h3a2 2 0 0 1 2 2v4h-2.5a1.5 1.5 0 0 0 0 3H21v7a2 2 0 0 1-2 2h-6v-2.5a1.5 1.5 0 0 0-3 0V21H5a2 2 0 0 1-2-2v-6h2.5a1.5 1.5 0 0 0 0-3H3V5a2 2 0 0 1 2-2h4Z',
    intro: 'Logic puzzles and brain teasers that make you think before you move. Play at your own pace, look for patterns, and see how quickly you can find the solution.',
  },
  {
    slug: 'board', name: 'Board', color: '#1F9D63',
    icon: 'M4 4h16v16H4V4Zm2 2v5h5V6H6Zm7 0v5h5V6h-5Zm-7 7v5h5v-5H6Zm7 0v5h5v-5h-5Z',
    intro: 'Classic board games rebuilt for the browser. Play against the computer at the difficulty you like, or pass the device and play a friend on the same screen.',
  },
  {
    slug: 'strategy', name: 'Strategy', color: '#7A5CFF',
    icon: 'M12 2 9 5l1.5 1.5L9 9h6l-1.5-2.5L15 5l-3-3Zm-4 8v2h1l-1 6H6v4h12v-4h-2l-1-6h1v-2H8Z',
    intro: 'Games where planning ahead wins. Read your opponent, think a few moves ahead and outsmart the computer on harder difficulty levels.',
  },
  {
    slug: 'two-player', name: '2 Player', color: '#E5487D',
    icon: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20c0-3.3 2.7-6 6-6 1.6 0 3 .6 4 1.6A5.9 5.9 0 0 1 16 14c3.3 0 6 2.7 6 6v1H2v-1Z',
    intro: 'Games for two people on one device. Sit side by side, take turns on the same screen, and settle who is the real champion.',
  },
  {
    slug: 'classic', name: 'Classic', color: '#D99A00',
    icon: 'M12 2 14.6 8.3 21.5 9l-5.2 4.6 1.6 6.8L12 16.9 6.1 20.4l1.6-6.8L2.5 9l6.9-.7L12 2Z',
    intro: 'Timeless games everyone knows, from schoolyard favourites to the first video games. Familiar rules, instant fun and no tutorial needed.',
  },
  {
    slug: 'casual', name: 'Casual', color: '#FF8A1F',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM7.5 14h9a4.5 4.5 0 0 1-9 0Z',
    intro: 'Relaxed games with simple rules and short rounds. Easy to learn, quick to play and good for a few minutes of fun.',
  },
  {
    slug: 'card', name: 'Card', color: '#9B4DCA',
    icon: 'M7 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 5c-1.5 1.6-3 2.8-3 4.3A1.8 1.8 0 0 0 11 13.5V15h2v-1.5a1.8 1.8 0 0 0 3-1.2C16 10.8 14.5 9.6 13 8h-2Z',
    intro: 'Solitaire and card games you can play right away, no shuffling required.',
  },
  {
    slug: 'word', name: 'Word', color: '#0E9F9A',
    icon: 'M4 5h16v3h-2V7h-5v10h2v2H9v-2h2V7H6v1H4V5Z',
    intro: 'Word games that test your vocabulary and spelling.',
  },
  {
    slug: 'sports', name: 'Sports', color: '#22A6E0',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3 3 2-1 3.5h-4L9 7l3-2Zm-6.4 4.3L8 10.5l1.2 3.7-2.3 2.7A7.9 7.9 0 0 1 5.6 9.3Zm12.8 0a7.9 7.9 0 0 1-1.3 7.6l-2.3-2.7 1.2-3.7 2.4-1.2ZM10 16h4l1.6 2.6a8 8 0 0 1-7.2 0L10 16Z',
    intro: 'Sports games for quick matches: shoot, score and beat your best.',
  },
];

export const categoryBySlug = Object.fromEntries(categories.map(c => [c.slug, c]));

// Static pages built from src/pages/*.html
export const staticPages = ['about', 'contact', 'privacy-policy', 'terms'];
