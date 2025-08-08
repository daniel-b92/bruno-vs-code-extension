import { PlainTextWithinBlock } from "../../../../../shared";

export function getSortedPlainTextLinesByPosition(
    plainTextLines: PlainTextWithinBlock[]
) {
    return plainTextLines.sort(
        ({ range: range1 }, { range: range2 }) =>
            range1.start.line - range2.start.line
    );
}
