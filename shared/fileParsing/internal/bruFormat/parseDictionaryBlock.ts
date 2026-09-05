import {
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    PlainTextWithinDictionaryArrayValue,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
    DictionaryBlockDescription,
    DictionaryBlockTypeAnnotation,
    DictionaryBlockTypeAnnotationValue,
    MultilineStringAdditionalData,
} from "../../..";
import { getContentRangeForArrayOrDictionaryBlock } from "../../external/bruFormat/util/getContentRangeForArrayOrDictionaryBlock";

type ParsedFieldOrLine =
    | DictionaryBlockArrayField
    | {
          field: DictionaryBlockSimpleField;
          startIndexInFile: number;
          couldBeStartofArrayField: boolean;
      }
    | DictionaryBlockDescription
    | DictionaryBlockTypeAnnotation
    | PlainTextWithinBlock;

export function parseDictionaryBlock(
    docHelper: TextDocumentHelper,
    firstContentLine: number,
    lastContentLine: number,
) {
    const lines: ParsedFieldOrLine[] = [];

    for (
        let lineIndex = firstContentLine;
        lineIndex <= lastContentLine;
        lineIndex++
    ) {
        const lineContent = docHelper.getLineByIndex(lineIndex);
        const hasSingleLineKeyValueStructure =
            isSingleLineKeyValuePair(lineContent);
        const hasMultilineKeyValueStructure =
            isStartOfMultilineKeyValuePair(lineContent);

        if (hasSingleLineKeyValueStructure || hasMultilineKeyValueStructure) {
            const keyAndValue = getKeyAndValueStartingInLine(
                {
                    lineIndex,
                    lineText: lineContent,
                },
                lastContentLine,
                docHelper,
                hasMultilineKeyValueStructure,
            );

            if (!keyAndValue) {
                return undefined;
            }
            const field = keyAndValue;
            // Skip lines that belong to the value, in case it's a multiline value.
            lineIndex = field.valueRange.end.line;

            lines.push({
                field,
                startIndexInFile: lineIndex,
                couldBeStartofArrayField: field.value.trim() == "[",
            });

            continue;
        }

        const previousLineIndex = lines.findIndex(
            (line) =>
                wasLineParsedAsValidSimpleField(line) &&
                line.startIndexInFile == lineIndex - 1,
        );

        const IsFirstValueLineWithinArrayField =
            previousLineIndex >= 0 &&
            (
                lines[previousLineIndex] as {
                    couldBeStartofArrayField: boolean;
                }
            ).couldBeStartofArrayField &&
            !lineContent.includes(":");

        if (!IsFirstValueLineWithinArrayField) {
            if (isSingleLineDescription(lineContent)) {
                const lineRange = docHelper.getRangeForLine(lineIndex, true);

                if (lineRange) {
                    lines.push({
                        range: lineRange,
                    } as unknown as DictionaryBlockDescription);
                }
                continue;
            }
            if (isStartOfMultilineDescription(lineContent)) {
                const parsedLine = parseMultilineString(
                    docHelper,
                    lineIndex,
                    lastContentLine,
                );
                lines.push({
                    range: parsedLine.range,
                    multilineValueSpecificData: parsedLine.additionalData,
                });
                // Skip lines that belong to the multiline description.
                lineIndex = parsedLine.range.end.line;
                continue;
            }

            const typeAnnotationValue =
                getTypeAnnotationValueForLine(lineContent);
            if (typeAnnotationValue) {
                const lineRange = docHelper.getRangeForLine(lineIndex, true);

                if (lineRange) {
                    lines.push({
                        range: lineRange,
                        ...typeAnnotationValue,
                    });
                }
                continue;
            }

            lines.push({
                text: lineContent,
                range: docHelper.getRangeForLine(lineIndex) as Range,
            });
            continue;
        }

        // Remove previous line that was seen as a simple field since it makes more sense to be seen as the start of an array field.
        const fieldStartLine = lines.splice(previousLineIndex, 1)[0] as {
            field: DictionaryBlockSimpleField;
        };

        const {
            disabled,
            key,
            keyRange,
            valueRange: { end: valueRangeStart },
        } = fieldStartLine.field;

        const { field: arrayField } = parseArrayField(
            docHelper,
            valueRangeStart,
            lastContentLine,
            {
                disabled: disabled,
                name: key,
                range: keyRange,
            },
        );
        const fieldEndLineIndex = arrayField.arrayRange.end?.line ?? undefined;

        lines.push(arrayField);

        // Skip lines that belong to the array field
        lineIndex =
            fieldEndLineIndex && fieldEndLineIndex < lastContentLine
                ? fieldEndLineIndex
                : lastContentLine;
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
    arrayStart: Position,
    lastBlockContentLine: number,
    parsedKey: { disabled: boolean; name: string; range: Range },
): { field: DictionaryBlockArrayField } {
    let arrayEndPosition: Position | undefined = undefined;
    let lineIndex = arrayStart.line + 1;

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
            arrayEndPosition = new Position(lineIndex, line.indexOf("]"));
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

        if (arrayEndPosition) {
            break;
        }

        lineIndex++;
    }

    return {
        field: {
            disabled: parsedKey.disabled,
            key: parsedKey.name,
            keyRange: parsedKey.range,
            arrayRange: { start: arrayStart, end: arrayEndPosition },
            values: parsedValues.map(({ content, range }) => ({
                content,
                range,
            })),
            plainTextWithinValues: parsedPlainTextLines.map(
                ({ parsedLine: line }) => line,
            ),
        },
    };
}

function wasLineParsedAsValidSimpleField(
    parsedLine: ParsedFieldOrLine,
): parsedLine is {
    field: DictionaryBlockSimpleField;
    startIndexInFile: number;
    couldBeStartofArrayField: boolean;
} {
    return "couldBeStartofArrayField" in parsedLine;
}

function isSingleLineDescription(lineText: string) {
    return /^\s*@description\(('[^']*'|"(\\"|[^"])*")\)\s*$/.test(lineText);
}

function isStartOfMultilineDescription(lineContent: string) {
    return /^\s*@description\('''.*$/.test(lineContent);
}

function getTypeAnnotationValueForLine(lineText: string) {
    const pattern = /^\s*@(number|boolean|object)\s*$/;
    const matches = pattern.exec(lineText);

    return matches && matches.length > 1
        ? { value: matches[1] as DictionaryBlockTypeAnnotationValue }
        : undefined;
}

function isSingleLineKeyValuePair(lineText: string) {
    return getSingleLineKeyValuePairPattern().test(lineText);
}

function isStartOfMultilineKeyValuePair(lineContent: string) {
    return /^\s*([^:]+)\s*:\s*'''.*$/.test(lineContent);
}

function getKeyAndValueStartingInLine(
    firstLine: {
        lineIndex: number;
        lineText: string;
    },
    lastBlockContentLine: number,
    fullDocHelper: TextDocumentHelper,
    isMultilineValue: boolean,
): DictionaryBlockSimpleField | undefined {
    const { lineIndex: firstLineIndex, lineText: firstLineText } = firstLine;
    const keyWithRange = getKeyFromLine(firstLineText, firstLineIndex);

    if (!keyWithRange) {
        return undefined;
    }

    if (!isMultilineValue) {
        const matches = getSingleLineKeyValuePairPattern().exec(firstLineText);

        if (!matches || matches.length < 3) {
            return undefined;
        }

        const {
            keyRange: {
                end: { character: keyEndIndex },
            },
        } = keyWithRange;

        const value = matches[2];
        const valueStartIndex =
            keyEndIndex + firstLineText.substring(keyEndIndex).indexOf(value);

        return {
            ...keyWithRange,
            value,
            valueRange: new Range(
                new Position(firstLineIndex, valueStartIndex),
                new Position(firstLineIndex, valueStartIndex + value.length),
            ),
        };
    }

    const {
        range: valueRange,
        value,
        additionalData,
    } = parseMultilineString(
        fullDocHelper,
        firstLineIndex,
        lastBlockContentLine,
    );
    return {
        ...keyWithRange,
        value,
        valueRange,
        multilineValueSpecificData: additionalData,
    };
}

function getKeyFromLine(lineContent: string, lineIndex: number) {
    const matches = /^\s*([^:]+)\s*:/.exec(lineContent);

    if (!matches || matches.length < 2) {
        return undefined;
    }

    const isDisabled = matches[1].startsWith("~");
    const key = isDisabled
        ? matches[1].length > 1
            ? matches[1].substring(1)
            : ""
        : matches[1];
    const keyStartIndex = lineContent.indexOf(key);
    const keyEndIndex = keyStartIndex + key.length;

    return {
        disabled: isDisabled,
        key,
        keyRange: new Range(
            new Position(lineIndex, keyStartIndex),
            new Position(lineIndex, keyEndIndex),
        ),
    };
}

function parseMultilineString(
    fullFileDocumentHelper: TextDocumentHelper,
    stringStartLine: number,
    lastBlockContentLine: number,
): {
    value: string;
    range: Range;
    additionalData: MultilineStringAdditionalData;
} {
    const surroundingQuotes = "'''";
    const startLineContent =
        fullFileDocumentHelper.getLineByIndex(stringStartLine);
    const startChar = startLineContent.lastIndexOf(surroundingQuotes);
    const stringStartPosition = new Position(stringStartLine, startChar);
    const textInLineWithOpeningQuotes =
        startChar < startLineContent.trimEnd().length - surroundingQuotes.length
            ? new Range(
                  new Position(
                      stringStartLine,
                      startChar + surroundingQuotes.length,
                  ),
                  new Position(stringStartLine, startLineContent.length),
              )
            : undefined;

    // Skip the line with the opening quotes for parsing the content.
    let lineIndex = stringStartLine + 1;

    while (lineIndex <= lastBlockContentLine) {
        const line = fullFileDocumentHelper.getLineByIndex(lineIndex);
        const isEndOfString = line.includes("'''");

        if (isEndOfString) {
            const endChar =
                line.indexOf(surroundingQuotes) + surroundingQuotes.length;
            const stringEndPosition = new Position(lineIndex, endChar);
            const range = new Range(stringStartPosition, stringEndPosition);
            const textInLineWithClosingQuotes = line
                .trimStart()
                .startsWith(surroundingQuotes)
                ? undefined
                : new Range(
                      new Position(lineIndex, 0),
                      new Position(
                          lineIndex,
                          endChar - surroundingQuotes.length,
                      ),
                  );
            const tailingTextAfterClosingQuotes =
                line.trimEnd().length == endChar
                    ? undefined
                    : new Range(
                          new Position(lineIndex, endChar),
                          new Position(lineIndex, line.length),
                      );

            return {
                value: fullFileDocumentHelper.getText(range),
                range,
                additionalData: {
                    tailingTextAfterClosingQuotes:
                        tailingTextAfterClosingQuotes,
                    invalidIncludedTextInClosingLine:
                        textInLineWithClosingQuotes,
                    invalidIncludedTextInOpeningLine:
                        textInLineWithOpeningQuotes,
                },
            };
        }

        lineIndex++;
    }

    // Case, where there are no closing quotes, so the value ends only due to the end of the block.
    const range = new Range(
        stringStartPosition,
        fullFileDocumentHelper.getRangeForLine(lastBlockContentLine)?.end ??
            new Position(lastBlockContentLine + 1, 0),
    );

    return {
        additionalData: { err: "missingClosingQuotes" },
        range,
        value: fullFileDocumentHelper.getText(range),
    };
}

function getSingleLineKeyValuePairPattern() {
    return /^\s*([^:]+)\s*:\s*(\S+.*?|.{0})\s*$/;
}
