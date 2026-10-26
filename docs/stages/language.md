# Arabic as the main language: theme groundwork

## What changed (dev theme only)

| File | Change |
|---|---|
| `locales/ar.json` | Now the complete Arabic storefront: 246 missing strings added. Your own Arabic wording (41 strings such as "أضيفي للسلة", "المقاس ده خلص") replaces the generic Arabic. 55 machine-translation errors fixed: "In stock" was "في الأوراق المالية" ("in the stock market"), and "Search", "Close", "Cancel" and "Create" were 3rd-person verbs. Two cart strings had a broken link (`{{%20link%20}}`) and are repaired. Shopify's checkout and customer-account strings in this file are untouched. |
| `locales/en.default.json` | Real English again for the 41 strings that had been overwritten in Arabic, so `/en` visitors see English. |

Every string was checked automatically: `{{ placeholders }}` and HTML tags match the English source. The only allowed exception is Arabic singular forms ("منتج واحد" instead of "1 منتج").

## Switching the main language (Shopify admin, not possible via API)

The theme and the store setting must change **together**:

1. Publish the dev theme (after the remaining stages are approved).
2. Straight after: Settings → Languages → **Change default** → Arabic.

Why together: the live theme's old `ar.json` contains the machine-translation errors above. The new theme's `en.default.json` is English, so publishing it alone turns the default storefront's buttons English until step 2.

After the switch, Arabic is served at `/` and English at `/en/`. Shopify generates the hreflang tags. Product titles are already bilingual ("Skirt | جيبة"), so they read correctly in both.

## Not done yet: right-to-left layout

`<html lang>` already follows the visitor's language, so it becomes `ar` automatically. The page direction is still left-to-right. Dawn has no built-in RTL, so turning on `dir="rtl"` affects every section (menus, drawers, sliders, icons). It needs to be checked page by page in a browser, and is planned together with the header and collection work. New code is written RTL-ready (logical CSS properties).
