import { Position, Range } from "vscode";
import { ArrayBlockField, DictionaryBlockField } from "../external/interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { BlockBracket } from "./util/blockBracketEnum";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    shouldBeArrayBlock: boolean
): {
    content: string | DictionaryBlockField[] | ArrayBlockField[];
    contentRange: Range;
} => {
    const lines: {
        content: string | DictionaryBlockField | ArrayBlockField;
    }[] = [];
    let openBracketsOnBlockLevel = 1;
    // the block content is exclusive of the block's opening curly bracket line
    const firstLine = startingPosition.line + 1;
    let lineIndex = firstLine;

    while (
        openBracketsOnBlockLevel > 0 &&
        lineIndex < document.getLineCount()
    ) {
        const line = document.getLineByIndex(lineIndex);
        const openingBracketsMatches = line.match(
            new RegExp(
                shouldBeArrayBlock
                    ? `\\${BlockBracket.OpeningBracketForArrayBlock}`
                    : `\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`
            )
        );
        const closingBracketsMatches = line.match(
            new RegExp(
                shouldBeArrayBlock
                    ? `\\${BlockBracket.ClosingBracketForArrayBlock}`
                    : `\\${BlockBracket.ClosingBracketForDictionaryOrTextBlock}`
            )
        );

        openBracketsOnBlockLevel =
            openBracketsOnBlockLevel +
            (openingBracketsMatches ? openingBracketsMatches.length : 0) -
            (closingBracketsMatches ? closingBracketsMatches.length : 0);

        // the block content is exclusive of the block's closing bracket line
        if (openBracketsOnBlockLevel > 0) {
            if (shouldBeArrayBlock) {
                lines.push(
                    isArrayBlockLine(line)
                        ? {
                              content:
                                  getArrayKeyFromLine(lineIndex, line) ?? line,
                          }
                        : { content: line }
                );
            } else {
                lines.push(
                    isKeyValuePair(line)
                        ? {
                              content:
                                  getKeyAndValueFromLine(lineIndex, line) ??
                                  line,
                          }
                        : { content: line }
                );
            }
            lineIndex++;
        }
    }

    const range = new Range(
        new Position(firstLine, 0),
        new Position(
            lineIndex,
            document
                .getLineByIndex(lineIndex)
                .lastIndexOf(
                    shouldBeArrayBlock
                        ? BlockBracket.ClosingBracketForArrayBlock
                        : BlockBracket.ClosingBracketForDictionaryOrTextBlock
                )
        )
    );

    return {
        content: lines.some((line) => typeof line.content == "string")
            ? document.getText(range)
            : shouldBeArrayBlock
            ? (lines as { content: ArrayBlockField }[]).map(
                  ({ content }) => content
              )
            : (lines as { content: DictionaryBlockField }[]).map(
                  ({ content }) => content
              ),
        contentRange: range,
    };
};

const isKeyValuePair = (lineText: string) =>
    getKeyValuePairLinePattern().test(lineText);

const getKeyAndValueFromLine = (
    lineIndex: number,
    lineText: string
): DictionaryBlockField | undefined => {
    const matches = getKeyValuePairLinePattern().exec(lineText);

    if (matches && matches.length > 2) {
        const key = matches[1];
        const value = matches[2];
        const keyStartIndex = lineText.indexOf(key);
        const keyEndIndex = keyStartIndex + key.length;
        const valueStartIndex =
            keyEndIndex + lineText.substring(keyEndIndex).indexOf(value);

        return {
            key,
            value,
            keyRange: new Range(
                new Position(lineIndex, keyStartIndex),
                new Position(lineIndex, keyEndIndex)
            ),
            valueRange: new Range(
                new Position(lineIndex, valueStartIndex),
                new Position(lineIndex, valueStartIndex + value.length)
            ),
        };
    } else {
        return undefined;
    }
};

const getKeyValuePairLinePattern = () => /^\s*(\S+)\s*:\s*(\S+.*?|.{0})\s*$/;

const isArrayBlockLine = (lineText: string) =>
    getArrayBlockLinePattern().test(lineText);

const getArrayKeyFromLine = (
    lineIndex: number,
    lineText: string
): ArrayBlockField | undefined => {
    const matches = getArrayBlockLinePattern().exec(lineText);

    if (!matches || matches.length <= 1) {
        return undefined;
    }

    const key = matches[1];
    const keyStartIndex = lineText.indexOf(key);
    const keyEndIndex = keyStartIndex + key.length;

    return {
        entry: key,
        entryRange: new Range(
            new Position(lineIndex, keyStartIndex),
            new Position(lineIndex, keyEndIndex)
        ),
    };
};

const getArrayBlockLinePattern = () => /^\s*(\S.*?)?,?\s*$/;
