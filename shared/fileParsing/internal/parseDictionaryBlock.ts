import {
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    PlainTextWithinDictionaryArrayValue,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
} from "../..";
import { getContentRangeForArrayOrDictionaryBlock } from "../external/shared/util/getContentRangeForArrayOrDictionaryBlock";

type ParsedLine =
    | DictionaryBlockArrayField
    | {
          field: DictionaryBlockSimpleField;
          indexInFile: number;
          couldBeStartofArrayField: boolean;
      }
    | PlainTextWithinBlock;

export function parseDictionaryBlock(
    docHelper: TextDocumentHelper,
    firstContentLine: number,
    lastContentLine: number,
) {
    const lines: ParsedLine[] = [];

    for (
        let lineIndex = firstContentLine;
        lineIndex <= lastContentLine;
        lineIndex++
    ) {
        const lineContent = docHelper.getLineByIndex(lineIndex);
        const hasKeyValueStructure = isKeyValuePair(lineContent);

        if (hasKeyValueStructure) {
            const keyAndValue = getKeyAndValueFromLine(
                lineIndex,
                lineContent,
            ) as DictionaryBlockSimpleField;

            lines.push({
                field: keyAndValue,
                indexInFile: lineIndex,
                couldBeStartofArrayField: keyAndValue.value.trim() == "[",
            });
        } else {
            const previousLineIndex = lines.findIndex(
                (line) =>
                    wasLineParsedAsValidSimpleField(line) &&
                    line.indexInFile == lineIndex - 1,
            );

            const IsFirstValueLineWithinArrayField =
                previousLineIndex >= 0 &&
                (
                    lines[previousLineIndex] as {
                        couldBeStartofArrayField: boolean;
                    }
                ).couldBeStartofArrayField &&
                !lineContent.includes(":");

            if (IsFirstValueLineWithinArrayField) {
                // Remove previous line that was seen as a simple field since it makes more sense to be seen as the start of an array field.
                const fieldStartLine = lines.splice(
                    previousLineIndex,
                    1,
                )[0] as {
                    field: DictionaryBlockSimpleField;
                };

                const { disabled, key, keyRange } = fieldStartLine.field;

                const { field: arrayField, fieldEndLineIndex } =
                    parseArrayField(docHelper, lineIndex, lastContentLine, {
                        disabled: disabled,
                        name: key,
                        range: keyRange,
                    });

                lines.push(arrayField);

                // Skip lines that belong to the array field
                lineIndex =
                    fieldEndLineIndex && fieldEndLineIndex < lastContentLine
                        ? fieldEndLineIndex
                        : lastContentLine;
            } else {
                lines.push({
                    text: lineContent,
                    range: docHelper.getRangeForLine(lineIndex) as Range,
                });
            }
        }
    }

    return {
        content: lines.map((line) =>
            wasLineParsedAsValidSimpleField(line) ? line.field : line,
        ),
        contentRange: getContentRangeForArrayOrDictionaryBlock(
            firstContentLine,
            BlockBracket.ClosingBracketForDictionaryOrTextBlock,
            lastContentLine + 1,
            docHelper.getLineByIndex(lastContentLine + 1),
        ),
    };
}

function parseArrayField(
    fullFileDocumentHelper: TextDocumentHelper,
    firstValueLineIndex: number,
    lastBlockContentLine: number,
    parsedKey: { disabled: boolean; name: string; range: Range },
): { field: DictionaryBlockArrayField; fieldEndLineIndex?: number } {
    let foundEndOfArrayField = false;
    let lineIndex = firstValueLineIndex;

    const parsedValues: { content: string; range: Range; lineIndex: number }[] =
        [];

    const parsedPlainTextLines: {
        parsedLine: PlainTextWithinDictionaryArrayValue;
        lineIndex: number;
    }[] = [];

    while (lineIndex <= lastBlockContentLine) {
        const line = fullFileDocumentHelper.getLineByIndex(lineIndex);
        const isEndOfArrayField = line.trim() == "]";

        if (isEndOfArrayField) {
            foundEndOfArrayField = true;
        } else if (line.match(/^\s*$/)) {
            // Do not count a line that only contains whitespaces as a line with a real value.
            parsedPlainTextLines.push({
                parsedLine: {
                    text: line,
                    range: new Range(
                        new Position(lineIndex, 0),
                        new Position(lineIndex, line.length),
                    ),
                },
                lineIndex,
            });
        } else {
            const content = line.trim();
            const contentStartIndex = line.indexOf(content);
            const contentEndIndex = contentStartIndex + content.length;

            parsedValues.push({
                content,
                range: new Range(
                    new Position(lineIndex, contentStartIndex),
                    new Position(lineIndex, contentEndIndex),
                ),
                lineIndex,
            });
        }

        if (foundEndOfArrayField) {
            break;
        }

        lineIndex++;
    }

    return {
        field: {
            disabled: parsedKey.disabled,
            key: parsedKey.name,
            keyRange: parsedKey.range,
            values: parsedValues.map(({ content, range }) => ({
                content,
                range,
            })),
            plainTextWithinValues: parsedPlainTextLines.map(
                ({ parsedLine: line }) => line,
            ),
        },
        fieldEndLineIndex: foundEndOfArrayField ? lineIndex : undefined,
    };
}

function wasLineParsedAsValidSimpleField(
    parsedLine: ParsedLine,
): parsedLine is {
    field: DictionaryBlockSimpleField;
    indexInFile: number;
    couldBeStartofArrayField: boolean;
} {
    return "couldBeStartofArrayField" in parsedLine;
}

function isKeyValuePair(lineText: string) {
    return getKeyValuePairLinePattern().test(lineText);
}

function getKeyAndValueFromLine(
    lineIndex: number,
    lineText: string,
): DictionaryBlockSimpleField | undefined {
    const matches = getKeyValuePairLinePattern().exec(lineText);

    if (matches && matches.length > 2) {
        const isDisabled = matches[1].startsWith("~");
        const key = isDisabled
            ? matches[1].length > 1
                ? matches[1].substring(1)
                : ""
            : matches[1];
        const value = matches[2];
        const keyStartIndex = lineText.indexOf(key);
        const keyEndIndex = keyStartIndex + key.length;
        const valueStartIndex =
            keyEndIndex + lineText.substring(keyEndIndex).indexOf(value);

        return {
            disabled: isDisabled,
            key,
            value,
            keyRange: new Range(
                new Position(lineIndex, keyStartIndex),
                new Position(lineIndex, keyEndIndex),
            ),
            valueRange: new Range(
                new Position(lineIndex, valueStartIndex),
                new Position(lineIndex, valueStartIndex + value.length),
            ),
        };
    } else {
        return undefined;
    }
}

function getKeyValuePairLinePattern() {
    return /^\s*(\S+)\s*:\s*(\S+.*?|.{0})\s*$/;
}
