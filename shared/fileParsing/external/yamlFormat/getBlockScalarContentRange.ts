import { Position, Range, TextDocumentHelper } from "../../..";

/**
 * @param headerLine The (0-based) line of the block scalar's header (e.g. `code: |`).
 * @param valueEnd The end of the range of the block scalar's value. It usually is the start of the line following the content.
 * @returns The range of the content lines of the block scalar (including the indentation), but not the header line.
 */
export function getBlockScalarContentRange(
    headerLine: number,
    valueEnd: Position,
    docHelper: TextDocumentHelper,
): Range | undefined {
    const firstContentLine = headerLine + 1;
    const lastContentLine =
        valueEnd.character == 0 ? valueEnd.line - 1 : valueEnd.line;

    if (
        lastContentLine < firstContentLine ||
        lastContentLine >= docHelper.getLineCount()
    ) {
        return undefined;
    }

    return new Range(
        new Position(firstContentLine, 0),
        new Position(
            lastContentLine,
            docHelper.getLineByIndex(lastContentLine).length,
        ),
    );
}
