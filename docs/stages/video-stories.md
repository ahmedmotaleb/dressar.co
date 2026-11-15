# Video Stories (Nov 15)

Brief: "Shopify Dawn — Premium Shoppable Video Stories". A reusable section, **Video Stories**, that shows a row of vertical shoppable videos. It can be added to any page from the theme editor.

## What it does

**Layout** (`assets/dsr-video-stories.css`)
- 9:16 cards with 12px corners (setting: 0–24px).
- **Phones:** about two thirds of the screen per card. The active card is in the middle and the neighbours peek in at 92% scale and lower opacity.
- **From 750px:** "Cards in view on desktop" (3–6, default 5) across, with arrows beside the heading.
- Native scrolling with scroll-snap, so swiping is the browser's own. No carousel library.
- The row is padded so the first and last cards can also sit in the middle.
- Logical properties throughout, so Arabic mirrors. Arrow keys follow the reading direction.
- Card sizes are fixed by `aspect-ratio`, so nothing shifts when posters or videos load.

**Playback** (`assets/dsr-video-stories.js`, custom element `<dsr-video-stories>`)
- **Starting:**
  - Every video starts muted, with `playsinline` and `loop` (loop is a setting).
  - Only the active card plays, and only while at least a quarter of the section is on screen and the tab is visible.
  - Swiping or pressing an arrow pauses the old video before the new one starts.
- **One player per page:** a coordinator shared by every Video Stories section makes sure only one video plays at a time.
  - The one the shopper started themselves wins.
  - Otherwise, the section most in view wins.
- **Pausing and resuming:**
  - Leaving the viewport or hiding the tab pauses the video. Coming back resumes it, unless the shopper paused it.
- **Controls:** play/pause and mute buttons on the active card.
  - Real `<button>`s with labels that change with their state: 34px circles with a 44px touch area.
  - Controls on the other cards are `inert`, so the keyboard skips them.
- **No autoplay:**
  - With `prefers-reduced-motion`, Save-Data, or the setting off, nothing plays by itself; the poster shows with a play button.
  - If the browser refuses to autoplay, the card stays on its poster and the play button works.
- **Loop off:** when a video ends, the next card becomes active.

**Loading**
- Videos use `preload="none"` and their source is only set (`data-src` → `src`) when a card becomes active.
- Cards two or more away from the active one drop their source again, so a long row never holds many videos.
- **Video file:**
  - Where the browser plays HLS itself (Safari, iPhone; some Chrome builds), Shopify's HLS stream, which adapts to the screen and connection.
  - Elsewhere, an MP4: the one closest to 720px tall without going over.
  - On the real storefront, Liquid lists only the 1080p MP4 and the HLS stream, so in practice the MP4 is the 1080p file.
  - If the HLS stream fails, the MP4 is used instead.
- **Posters:**
  - The block's poster image if set, else Shopify's own preview frame.
  - `image_tag` with widths 270–720 and `sizes`.
  - Eager loading for the first card only.

**Shoppable**
- When a block has a product and "Show the linked product" is on, a small white bar sits at the foot of the card: photo, name and price, linking to the real product URL.
- **Price:** the price comes from Shopify (`money`, "From" when variants differ). A sold-out product shows "Sold out" instead of a price.
- Nothing is invented; with no product, there is no bar.

**Theme editor**
- **Section settings:**
  - heading and heading size;
  - autoplay (on by default);
  - loop;
  - card radius;
  - cards in view on desktop;
  - show the linked product;
  - colour scheme (background);
  - top and bottom padding for phones and for desktop.
- **Blocks:** a "Video" block (up to 20) with video, poster, product and caption. Blocks can be added, removed and reordered.
- **Editor behaviour:**
  - Selecting a block scrolls it to the middle.
  - When the editor reloads the section, `disconnectedCallback` removes every listener and observer and pauses the videos.
- No Dressar data is hard-coded. The preset has three empty video blocks, which show Shopify placeholders.

**Text:** `dressar.video_stories.*` in `locales/en.default.json` and `locales/ar.json`, copied to the other locales.

## Files

| File | |
|---|---|
| `sections/dsr-video-stories.liquid` | Section, blocks, schema |
| `assets/dsr-video-stories.css` | Layout |
| `assets/dsr-video-stories.js` | Playback, navigation, editor events |
| `locales/*.json` | `dressar.video_stories` strings |
| `templates/index.video-stories.json` | Preview-only demo with the store's own vertical videos; not assigned to any page |
| `tests/video-stories.test.js`, `tests/fixtures/videos/` | Tests and four short WebM clips |

## Tests

`tests/video-stories.test.js`: 168 checks in Chromium (Playwright), Arabic and English. The page holds two Video Stories sections. The checks cover:
- **Layout** at 360, 390, 430 and 1440px:
  - 9:16 cards, the active card centred, neighbours peeking;
  - no sideways page scroll.
- **Autoplay:**
  - muted, `playsinline`;
  - only the active video has a source;
  - only one video plays on the page.
- **Navigation:** swipe (touch scroll), arrows, and arrow keys in both reading directions.
- **Pausing:**
  - play/pause and mute buttons and their labels;
  - the section leaving the viewport and coming back;
  - a hidden tab;
  - two sections competing.
- **No autoplay:** reduced motion, Save-Data, autoplay refused by the browser, the autoplay setting off.
- **HLS:** the MP4 without native HLS; the stream first with native HLS, falling back to the MP4 when it fails.
- **Loop off:** advances to the next card.
- **Content:**
  - the product link (URL, price, sold out);
  - captions;
  - placeholders with no video.
- **Theme editor:**
  - a block selected with `shopify:block:select`;
  - the section removed from the page and inserted again, as the editor does when it re-renders;
  - the section moved in the page, with no doubled listeners.
- **Accessibility:** axe, with no violations.

## Not verified here

- **Real phones:** Android Chrome and iPhone Safari were not available. Only Chromium with phone emulation was tested. iOS autoplay rules, Low Power Mode and H.264 playback need checking on a real iPhone.
- **Theme editor:** adding, removing or reordering a block makes the editor re-render the section. That re-render (section removed and inserted again) and block selection were tested in a test page; a specific block reorder was not, not in the real Shopify editor.
- **The 2S reference recording** named in the brief didn't come through, so the look follows the written brief.
