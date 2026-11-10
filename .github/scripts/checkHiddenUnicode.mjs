// Fails if a tracked text file contains invisible or direction-changing Unicode characters. These can be used to
// make code look different from what is actually executed ("Trojan Source"), to hide code within seemingly
// empty strings (e.g. encoded as variation selectors) or to hide instructions for AI agents (e.g. in `CLAUDE.md`).

import { readFileSync } from "node:fs";
import { getTrackedFiles } from "./trackedFiles.mjs";

const suspiciousCharacters = [
    // Bidirectional control characters
    /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u,
    // Zero-width and other invisible characters (incl. byte order marks, combining grapheme joiner and Hangul fillers)
    /[\u00AD\u034F\u115F\u1160\u180E\u200B\u200C\u2060-\u2064\u3164\uFEFF\uFFA0]/u,
    // Zero width joiners, except for the ones within emoji sequences (e.g. family emojis)
    /(?<!\p{Extended_Pictographic}\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/u,
    // Line and paragraph separators, which some editors do not render as line breaks
    /[\u2028\u2029]/u,
    // Tag characters ("ASCII smuggling")
    /[\u{E0000}-\u{E007F}]/u,
    // Private use areas
    /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u,
    // Variation selectors, except for single ones directly after emojis (e.g. the warning sign emoji) or
    // directly before the enclosing keycap of keycap emojis (e.g. `1️⃣`)
    /[\uFE00-\uFE0D\u{E0100}-\u{E01EF}]|[\uFE0E\uFE0F]{2,}|(?<![\p{Extended_Pictographic}0-9#*])[\uFE0E\uFE0F]|(?<=[0-9#*])[\uFE0E\uFE0F](?!\u20E3)/u,
];

// Known occurrences that are fine, as file path -> allowed code points.
const allowedCharactersPerFile = new Map([
    // The grammars are copied from https://github.com/RedCMD/YAML-Syntax-Highlighter and contain the characters as data.
    ["syntaxes/_testingUtils/grammars/yaml-1.2.tmLanguage.json", ["FEFF"]],
    ["syntaxes/_testingUtils/grammars/yaml.tmLanguage.json", ["E000", "FEFF"]],
]);

const trackedFiles = getTrackedFiles();

const findings = [];

for (const file of trackedFiles) {
    const content = readFileSync(file);

    if (content.includes(0)) {
        // Binary file
        continue;
    }

    content
        .toString("utf8")
        .split("\n")
        .forEach((line, index) => {
            const allowedCodePoints = allowedCharactersPerFile.get(file) ?? [];

            for (const regex of suspiciousCharacters) {
                for (const match of line.matchAll(new RegExp(regex, "gu"))) {
                    const codePoint = match[0]
                        .codePointAt(0)
                        .toString(16)
                        .toUpperCase()
                        .padStart(4, "0");

                    if (!allowedCodePoints.includes(codePoint)) {
                        findings.push(
                            `${file}:${index + 1}:${match.index + 1}: suspicious character U+${codePoint}`,
                        );
                    }
                }
            }
        });
}

if (findings.length > 0) {
    console.error(findings.join("\n"));
    console.error(
        "\nInvisible or direction-changing Unicode characters found. Remove them or check carefully why they are needed (see CONTRIBUTING.md).",
    );
    process.exit(1);
}

console.log(
    `No suspicious Unicode characters found in ${trackedFiles.length} files.`,
);
