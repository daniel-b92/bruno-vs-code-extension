import {
    ArrayBlockField,
    DictionaryBlockField,
    PlainTextWithinBlock,
} from "../external/interfaces";
import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { BlockBracket } from "./util/blockBracketEnum";
import { Position, Range } from "../..";
import { BlockType } from "./util/BlockTypeEnum";
import { createSourceFile, Node, ScriptTarget, SyntaxKind } from "typescript";
import { getNonBlockSpecificBlockStartPattern } from "./util/getNonBlockSpecificBlockStartPattern";

export const getBlockContent = (
    document: TextDocumentHelper,
    startingPosition: Position,
    blockType: BlockType,
):
    | {
          content:
              | string
              | (DictionaryBlockField | PlainTextWithinBlock)[]
              | (ArrayBlockField | PlainTextWithinBlock)[];
          contentRange: Range;
      }
    | undefined => {
    // the block content is exclusive of the block's opening bracket line
    const firsContentLine = startingPosition.line + 1;

    switch (blockType) {
        case BlockType.Array:
            return parseArrayBlock(document, firsContentLine);
        case BlockType.Dictionary:
            return parseDictionaryBlock(document, firsContentLine);
        case BlockType.Code:
            return parseCodeBlock(document, firsContentLine);
        case BlockType.Json:
            return parseJsonBlock(document, firsContentLine);
        case BlockType.PlainText:
            // ToDo: Adjust parsing for plain text blocks by determining block end via full line regex pattern.
            return parseTextBlock(document, firsContentLine);
        default:
            throw new Error(
                `Cannot parse block with unknown type '${blockType}'. Known block types are ${JSON.stringify(
                    Object.entries(BlockType),
                    null,
                    2,
                )}`,
            );
    }
};

const parseArrayBlock = (
    document: TextDocumentHelper,
    firstContentLine: number,
) => {
    const allRemainingLines = document.getAllLines(firstContentLine);

    const lastLineForBlock = allRemainingLines.find(({ content }) =>
        content.includes(BlockBracket.ClosingBracketForArrayBlock),
    );

    if (lastLineForBlock == undefined) {
        return undefined;
    }

    const linesWithBlockContent = allRemainingLines.slice(
        0,
        allRemainingLines.findIndex(
            ({ index }) => index == lastLineForBlock.index,
        ),
    );

    const nonFinalBlockLines = linesWithBlockContent.slice(
        0,
        linesWithBlockContent.length - 1,
    );

    const nonFinalLinesNotMatchingPattern: PlainTextWithinBlock[] = [];

    const nonFinalLinesMatchingBlockPattern = nonFinalBlockLines.filter(
        ({ index, content }) => {
            if (getNonFinalArrayBlockLinePattern().test(content)) {
                return true;
            } else {
                nonFinalLinesNotMatchingPattern.push({
                    text: content,
                    range: document.getRangeForLine(index) as Range,
                });
                return false;
            }
        },
    );

    const lastContentLine =
        linesWithBlockContent[linesWithBlockContent.length - 1];
    const doesLastLineMatchBlockPattern = getLastArrayBlockLinePattern().test(
        lastContentLine.content,
    );

    return {
        content: (
            nonFinalLinesMatchingBlockPattern.map(({ content, index }) =>
                getArrayEntryFromLine(index, content, false),
            ) as (ArrayBlockField | PlainTextWithinBlock)[]
        )
            .concat(
                nonFinalLinesNotMatchingPattern.length > 0
                    ? nonFinalLinesNotMatchingPattern
                    : [],
            )
            .concat(
                doesLastLineMatchBlockPattern
                    ? [
                          getArrayEntryFromLine(
                              lastContentLine.index,
                              lastContentLine.content,
                              true,
                          ),
                      ]
                    : [
                          {
                              text: lastContentLine.content,
                              range: document.getRangeForLine(
                                  lastContentLine.index,
                              ) as Range,
                          },
                      ],
            ),
        contentRange: getContentRange(
            firstContentLine,
            BlockBracket.ClosingBracketForArrayBlock,
            lastLineForBlock.index,
            lastLineForBlock.content,
        ),
    };
};

const parseDictionaryBlock = (
    document: TextDocumentHelper,
    firstContentLine: number,
) => {
    const lines: {
        content: DictionaryBlockField | PlainTextWithinBlock;
    }[] = [];
    let openBracketsOnBlockLevel = 1;
    let lineIndex = firstContentLine;

    while (
        openBracketsOnBlockLevel > 0 &&
        lineIndex < document.getLineCount()
    ) {
        const line = document.getLineByIndex(lineIndex);

        const hasCorrectStructure = isKeyValuePair(line);

        if (hasCorrectStructure) {
            lines.push({
                content: getKeyAndValueFromLine(
                    lineIndex,
                    line,
                ) as DictionaryBlockField,
            });

            lineIndex++;
        } else {
            const openingBracketsMatches = line.match(
                new RegExp(
                    `\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`,
                ),
            );
            const closingBracketsMatches = line.match(
                new RegExp(
                    `\\${BlockBracket.ClosingBracketForDictionaryOrTextBlock}`,
                ),
            );

            // Only count brackets for block level, if they are not within a dictionary key or value entry.
            openBracketsOnBlockLevel =
                openBracketsOnBlockLevel +
                (openingBracketsMatches ? openingBracketsMatches.length : 0) -
                (closingBracketsMatches ? closingBracketsMatches.length : 0);

            // the block content is exclusive of the block's closing bracket line
            if (openBracketsOnBlockLevel > 0) {
                lines.push({
                    content: {
                        text: line,
                        range: document.getRangeForLine(lineIndex) as Range,
                    },
                });

                lineIndex++;
            }
        }
    }

    if (openBracketsOnBlockLevel > 0) {
        return undefined;
    }

    return {
        content: lines.map(({ content }) => content),
        contentRange: getContentRange(
            firstContentLine,
            BlockBracket.ClosingBracketForDictionaryOrTextBlock,
            lineIndex,
            document.getLineByIndex(lineIndex),
        ),
    };
};

const parseCodeBlock = (
    document: TextDocumentHelper,
    firstContentLine: number,
) => {
    const subDocumentStartPosition = new Position(firstContentLine - 1, 0);

    const subDocument = new TextDocumentHelper(
        document.getText(
            new Range(
                subDocumentStartPosition,
                new Position(
                    document.getLineCount() - 1,
                    Number.MAX_SAFE_INTEGER,
                ),
            ),
        ),
    );

    const sourceFile = createSourceFile(
        "__temp.js",
        subDocument.getText(),
        ScriptTarget.ES2020,
    );

    const blockNode = (sourceFile as Node)
        .getChildAt(0, sourceFile)
        .getChildren(sourceFile)
        .find(({ kind }) => kind == SyntaxKind.Block);

    if (!blockNode) {
        throw new Error(
            `Could not find code block within given subdocument: ${subDocument.getText()}`,
        );
    }

    const fullBlockEndOffset = blockNode.end;

    const blockContentEndInSubDocument = subDocument.getPositionForOffset(
        new Position(0, 0),
        fullBlockEndOffset - 1,
    );

    if (!blockContentEndInSubDocument) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        new Position(
            subDocumentStartPosition.line + blockContentEndInSubDocument.line,
            blockContentEndInSubDocument.character,
        ),
    );

    return {
        content: document.getText(contentRange),
        contentRange,
    };
};

const parseJsonBlock = (
    document: TextDocumentHelper,
    firstContentLine: number,
) => {
    const subDocumentStartPosition = new Position(firstContentLine, 0);

    const fullRemainingText = document.getText(
        new Range(
            subDocumentStartPosition,
            new Position(document.getLineCount() - 1, Number.MAX_SAFE_INTEGER),
        ),
    );

    const followingBlockStartIndex = fullRemainingText.search(
        getNonBlockSpecificBlockStartPattern(),
    );

    const blockContentEndIndex = fullRemainingText
        .substring(
            0,
            followingBlockStartIndex >= 0
                ? followingBlockStartIndex
                : undefined,
        )
        .lastIndexOf(BlockBracket.ClosingBracketForDictionaryOrTextBlock);

    const subDocument = new TextDocumentHelper(
        fullRemainingText.substring(0, blockContentEndIndex),
    );

    const sourceFile = createSourceFile(
        "__temp.json",
        subDocument.getText(),
        ScriptTarget.JSON,
    );

    const blockNode = (sourceFile as Node).getChildAt(0, sourceFile);

    if (!blockNode) {
        throw new Error(
            `Could not find JSON block within given subdocument: ${fullRemainingText}`,
        );
    }

    const blockContentEndInSubDocument = subDocument.getPositionForOffset(
        new Position(0, 0),
        blockContentEndIndex,
    );

    if (!blockContentEndInSubDocument) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        new Position(
            subDocumentStartPosition.line + blockContentEndInSubDocument.line,
            blockContentEndInSubDocument.character,
        ),
    );

    return {
        content: document.getText(contentRange),
        contentRange,
    };
};

const parseTextBlock = (
    document: TextDocumentHelper,
    firstContentLine: number,
) => {
    const result = document.getContentUntilClosingChar(
        firstContentLine,
        BlockBracket.OpeningBracketForDictionaryOrTextBlock,
        BlockBracket.ClosingBracketForDictionaryOrTextBlock,
    );

    return result
        ? { content: result.content, contentRange: result.range }
        : undefined;
};

const getContentRange = (
    firstLineIndex: number,
    closingBracket: BlockBracket,
    lineWithClosingBracketIndex: number,
    lastLineContent: string,
) =>
    new Range(
        new Position(firstLineIndex, 0),
        new Position(
            lineWithClosingBracketIndex,
            lastLineContent.lastIndexOf(closingBracket),
        ),
    );

const isKeyValuePair = (lineText: string) =>
    getKeyValuePairLinePattern().test(lineText);

const getKeyAndValueFromLine = (
    lineIndex: number,
    lineText: string,
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
};

const getKeyValuePairLinePattern = () => /^\s*(\S+)\s*:\s*(\S+.*?|.{0})\s*$/;

const getArrayEntryFromLine = (
    lineIndex: number,
    lineText: string,
    isLastArrayBlockLine: boolean,
): ArrayBlockField => {
    const entry = isLastArrayBlockLine
        ? lineText.trim()
        : lineText.replace(",", "").trim();

    const entryStartIndex = lineText.indexOf(entry);
    const entryEndIndex = entryStartIndex + entry.length;

    return {
        entry,
        entryRange: new Range(
            new Position(lineIndex, entryStartIndex),
            new Position(lineIndex, entryEndIndex),
        ),
    };
};

const getNonFinalArrayBlockLinePattern = () => /^\s*[a-zA-Z0-9-_\\.]*\s*,$/m;
const getLastArrayBlockLinePattern = () => /^\s*[a-zA-Z0-9-_\\.]*\s*$/m;
