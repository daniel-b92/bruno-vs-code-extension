import { TextDocument } from "vscode";
import { Position } from "@global_shared";

export function getMatchingTextContainingPosition(
    document: TextDocument,
    position: Position,
    pattern: RegExp,
) {
    let remainingText = document.lineAt(position.line).text;
    let alreadyCheckedText = "";

    do {
        const matches = pattern.exec(remainingText);

        if (!matches || matches.length == 0) {
            return undefined;
        }

        const startChar = alreadyCheckedText.length + matches.index;
        const endChar =
            alreadyCheckedText.length + matches.index + matches[0].length;

        const containsPosition =
            position.character >= startChar && position.character <= endChar;
        if (containsPosition) {
            return {
                text: matches[0],
                line: position.line,
                startChar,
                endChar,
            };
        }
        const currentSectionEnd = matches.index + matches[0].length;
        alreadyCheckedText = alreadyCheckedText.concat(
            remainingText.substring(0, currentSectionEnd),
        );

        remainingText = remainingText.substring(currentSectionEnd);
    } while (remainingText.length > 0);

    return undefined;
}
