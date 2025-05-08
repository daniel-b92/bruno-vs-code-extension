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

    if (shouldBeArrayBlock) {
        const allRemainingLines = document.getAllLines(lineIndex);

        const lastLineForBlock = allRemainingLines.some(({ content }) =>
            content.includes(BlockBracket.ClosingBracketForArrayBlock)
        )
            ? allRemainingLines.find(({ content }) =>
                  content.includes(BlockBracket.ClosingBracketForArrayBlock)
              )?.index
            : undefined;

        if (lastLineForBlock == undefined) {
            // ToDo: return undefined (or something similar) if no closing block bracket exists and handle this case correctly in the calling function.
            const range = new Range(
                startingPosition,
                new Position(
                    document.getLineCount() - 1,
                    document.getLineByIndex(document.getLineCount() - 1).length
                )
            );

            return { content: document.getText(range), contentRange: range };
        }

        const linesWithBlockContent = allRemainingLines.slice(
            0,
            allRemainingLines.findIndex(
                ({ index }) => index == lastLineForBlock
            )
        );

        const nonFinalArrayBlockLines = linesWithBlockContent.slice(
            0,
            linesWithBlockContent.length - 1
        );

        const lastArrayBlockContentLine =
            linesWithBlockContent[linesWithBlockContent.length - 1];

        const range = new Range(
            new Position(firstLine, 0),
            new Position(
                lastLineForBlock,
                (
                    allRemainingLines.find(
                        ({ index }) => index == lastLineForBlock
                    ) as { content: string }
                ).content.lastIndexOf(BlockBracket.ClosingBracketForArrayBlock)
            )
        );

        const allLinesMatchPattern =
            nonFinalArrayBlockLines.every((line) =>
                getNonFinalArrayBlockLinePattern().test(line.content)
            ) &&
            getLastArrayBlockLinePattern().test(
                lastArrayBlockContentLine.content
            );

        return {
            content: allLinesMatchPattern
                ? nonFinalArrayBlockLines
                      .map(({ content, index }) =>
                          getArrayEntryFromLine(index, content, false)
                      )
                      .concat([
                          getArrayEntryFromLine(
                              lastArrayBlockContentLine.index,
                              lastArrayBlockContentLine.content,
                              true
                          ),
                      ])
                : document.getText(range),
            contentRange: range,
        };
    }

    while (
        openBracketsOnBlockLevel > 0 &&
        lineIndex < document.getLineCount()
    ) {
        const line = document.getLineByIndex(lineIndex);
        const openingBracketsMatches = line.match(
            new RegExp(
                `\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`
            )
        );
        const closingBracketsMatches = line.match(
            new RegExp(
                `\\${BlockBracket.ClosingBracketForDictionaryOrTextBlock}`
            )
        );

        openBracketsOnBlockLevel =
            openBracketsOnBlockLevel +
            (openingBracketsMatches ? openingBracketsMatches.length : 0) -
            (closingBracketsMatches ? closingBracketsMatches.length : 0);

        // the block content is exclusive of the block's closing bracket line
        if (openBracketsOnBlockLevel > 0) {
            lines.push(
                isKeyValuePair(line)
                    ? {
                          content:
                              getKeyAndValueFromLine(lineIndex, line) ?? line,
                      }
                    : { content: line }
            );

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
                    BlockBracket.ClosingBracketForDictionaryOrTextBlock
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

const getArrayEntryFromLine = (
    lineIndex: number,
    lineText: string,
    isLastArrayBlockLine: boolean
): ArrayBlockField => {
    const entry = isLastArrayBlockLine
        ? lineText.replace(",", "").trim()
        : lineText.trim();

    const entryStartIndex = lineText.indexOf(entry);
    const entryEndIndex = entryStartIndex + entry.length;

    return {
        entry,
        entryRange: new Range(
            new Position(lineIndex, entryStartIndex),
            new Position(lineIndex, entryEndIndex)
        ),
    };
};

const getNonFinalArrayBlockLinePattern = () => /^\s*[a-zA-Z0-9-_\\.]*\s*,$/m;
const getLastArrayBlockLinePattern = () => /^\s*[a-zA-Z0-9-_\\.]*\s*$/m;
