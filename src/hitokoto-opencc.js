import OpenCC from "opencc-js";

// Hitokoto is predominantly Chinese, but quotes and their credits may arrive
// in Simplified Chinese. Use OpenCC's Taiwan Traditional character conversion
// with phrase localization (s2twp), rather than machine translation.
// Initialize once per server process; never send quote text to a new service.
const simplifiedToTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "twp" });

export function convertHitokotoToTraditional(quote) {
  return {
    ...quote,
    text: simplifiedToTaiwanTraditional(quote.text),
    speaker: simplifiedToTaiwanTraditional(quote.speaker),
    source: simplifiedToTaiwanTraditional(quote.source),
  };
}
