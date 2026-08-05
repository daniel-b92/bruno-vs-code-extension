import { Range as YamlRange } from "yaml";
import { Position, Range, TextDocumentHelper } from "../../../..";

export function fromYamlRange(
    { "0": startOffset, "2": endOffset }: YamlRange,
    docHelper: TextDocumentHelper,
): Range | undefined {
    const startPosition = docHelper.getPositionForOffset(
        new Position(0, 0),
        startOffset,
    );
    const endPosition = docHelper.getPositionForOffset(
        new Position(0, 0),
        endOffset,
    );

    return startPosition && endPosition
        ? new Range(startPosition, endPosition)
        : undefined;
}
