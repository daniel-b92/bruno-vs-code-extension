const lineBreakCharacters = [
    "\r",
    "\n",
    String.fromCharCode(0x2028),
    String.fromCharCode(0x2029),
];
const nonLineBreakCharacters = new RegExp(
    `[^${lineBreakCharacters.map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")}]`,
    "g",
);

/**
 * Replaces all characters except for line breaks by spaces, so that all offsets and line / character positions stay the same.
 */
export function maskContent(content: string) {
    return content.replace(nonLineBreakCharacters, " ");
}

export function isLineBreak(character: string) {
    return lineBreakCharacters.includes(character);
}
