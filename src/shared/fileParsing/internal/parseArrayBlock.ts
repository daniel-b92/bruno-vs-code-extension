import {
    ArrayBlockField,
    PlainTextWithinBlock,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
} from "../..";
import { getContentRangeForArrayOrDictionaryBlock } from "../external/shared/util/getContentRangeForArrayOrDictionaryBlock";

export function parseArrayBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
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
        contentRange: getContentRangeForArrayOrDictionaryBlock(
            firstContentLine,
            BlockBracket.ClosingBracketForArrayBlock,
            lastLineForBlock.index,
            lastLineForBlock.content,
        ),
    };
}

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
