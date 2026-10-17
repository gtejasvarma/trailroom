// Switches that turn a whole part of the product off without removing it.

/**
 * Buy, everywhere. Tejas, 2026-10-17: "For now temporarily hide buy button." While this is false
 * no Buy button or link is rendered (the mirror, Discover and product cards, outfits, Compare,
 * lists, the Sent screen) and the "Did it arrive?" question is never asked. The routes, the buy
 * sheet, the purchases API and the code behind each button stay, so setting this to true brings
 * everything back as it was.
 */
export const BUY_ENABLED = false;
