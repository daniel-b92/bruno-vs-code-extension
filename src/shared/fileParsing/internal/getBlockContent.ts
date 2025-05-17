import { ArrayBlockField, DictionaryBlockField } from "../external/interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { BlockBracket } from "./util/blockBracketEnum";
import { Position, Range } from "../..";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    shouldBeArrayBlock: boolean
):
    | {
          content: string | DictionaryBlockField[] | ArrayBlockField[];
          contentRange: Range;
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firsContentLine = startingPosition.line + 1;

    if (shouldBeArrayBlock) {
        return parseArrayBlock(document, firsContentLine);
    } else {
        return parseTextOrDictionaryBlock(document, firsContentLine);
    }
};

const parseArrayBlock = (
    document: TextDocumentHelper,
    firstContentLine: number
) => {
    const allRemainingLines = document.getAllLines(firstContentLine);

    const lastLineForBlock = allRemainingLines.find(({ content }) =>
        content.includes(BlockBracket.ClosingBracketForArrayBlock)
    );

    if (lastLineForBlock == undefined) {
        return undefined;
    }

    const linesWithBlockContent = allRemainingLines.slice(
        0,
        allRemainingLines.findIndex(
            ({ index }) => index == lastLineForBlock.index
        )
    );

    const nonFinalArrayBlockLines = linesWithBlockContent.slice(
        0,
        linesWithBlockContent.length - 1
    );

    const lastContentLine =
        linesWithBlockContent[linesWithBlockContent.length - 1];

    const blockRange = new Range(
        new Position(firstContentLine, 0),
        new Position(
            lastLineForBlock.index,
            lastLineForBlock.content.lastIndexOf(
                BlockBracket.ClosingBracketForArrayBlock
            )
        )
    );

    const allLinesMatchPattern =
        nonFinalArrayBlockLines.every((line) =>
            getNonFinalArrayBlockLinePattern().test(line.content)
        ) && getLastArrayBlockLinePattern().test(lastContentLine.content);

    return {
        content: allLinesMatchPattern
            ? nonFinalArrayBlockLines
                  .map(({ content, index }) =>
                      getArrayEntryFromLine(index, content, false)
                  )
                  .concat([
                      getArrayEntryFromLine(
                          lastContentLine.index,
                          lastContentLine.content,
                          true
                      ),
                  ])
            : document.getText(blockRange),
        contentRange: blockRange,
    };
};

const parseTextOrDictionaryBlock = (
    document: TextDocumentHelper,
    firstContentLine: number
) => {
    const lines: {
        content: string | DictionaryBlockField | ArrayBlockField;
    }[] = [];
    let openBracketsOnBlockLevel = 1;
    let lineIndex = firstContentLine;

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

    if (openBracketsOnBlockLevel > 0) {
        return undefined;
    }

    const range = new Range(
        new Position(firstContentLine, 0),
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
