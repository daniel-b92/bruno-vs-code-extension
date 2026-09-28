import {
    EnvironmentFileTopLevelField,
    Position,
    Range,
    TextDocumentHelper,
    TextOutsideOfBlocks,
} from "../../..";

export interface EnvironmentFileExtendsField {
    value: string;
    keyRange: Range;
    valueRange: Range;
    fullRange: Range;
}

export function getAllExtendsFields(
    docHelper: TextDocumentHelper,
    textOutsideOfBlocks: TextOutsideOfBlocks[],
): EnvironmentFileExtendsField[] {
    const pattern = new RegExp(
        `^(\\s*)(${EnvironmentFileTopLevelField.Extends})(\\s*:\\s*)(.*?)\\s*$`,
    );
    const result: EnvironmentFileExtendsField[] = [];

    for (const { range } of textOutsideOfBlocks) {
        for (
            let lineIndex = range.start.line;
            lineIndex <= range.end.line;
            lineIndex++
        ) {
            const lineContent = docHelper.getLineByIndex(lineIndex);
            const match = pattern.exec(lineContent);

            if (!match) {
                continue;
            }

            const keyStart = match[1].length;
            const keyEnd = keyStart + match[2].length;
            const valueStart = keyEnd + match[3].length;
            const valueEnd = valueStart + match[4].length;

            result.push({
                value: match[4],
                keyRange: new Range(
                    new Position(lineIndex, keyStart),
                    new Position(lineIndex, keyEnd),
                ),
                valueRange: new Range(
                    new Position(lineIndex, valueStart),
                    new Position(lineIndex, valueEnd),
                ),
                fullRange: new Range(
                    new Position(lineIndex, 0),
                    new Position(lineIndex, lineContent.length),
                ),
            });
        }
    }

    return result;
}
