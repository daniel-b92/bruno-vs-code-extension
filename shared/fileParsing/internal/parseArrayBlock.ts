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
    docHelper: TextDocumentHelper,
    firstContentLine: number,
    lastContentLine: number,
) {
    const linesWithBlockContent = docHelper
        .getAllLines(firstContentLine)
        .filter(({ index }) => index <= lastContentLine);

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
                    range: docHelper.getRangeForLine(index) as Range,
                });
                return false;
            }
        },
    );

    const lastLineContent =
        linesWithBlockContent[linesWithBlockContent.length - 1].content;
    const doesLastLineMatchBlockPattern =
        getFinalLinePattern().test(lastLineContent);

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
                              lastContentLine,
                              lastLineContent,
                              true,
                          ),
                      ]
                    : [
                          {
                              text: lastLineContent,
                              range: docHelper.getRangeForLine(
                                  lastContentLine,
                              ) as Range,
                          },
                      ],
            ),
        contentRange: getContentRangeForArrayOrDictionaryBlock(
            firstContentLine,
            BlockBracket.ClosingBracketForArrayBlock,
            lastContentLine + 1,
            docHelper.getLineByIndex(lastContentLine + 1),
        ),
    };
}

const getArrayEntryFromLine = (
    lineIndex: number,
    lineText: string,
    isLastArrayBlockLine: boolean,
): ArrayBlockField => {
    const isDisabled = lineText.trimStart().startsWith("~");
    const withTrimmedStart = isDisabled
        ? lineText.trimStart().slice(1)
        : lineText.trimStart();

    const entry = isLastArrayBlockLine
        ? withTrimmedStart.trimEnd()
        : withTrimmedStart.replace(",", "").trimEnd();

    const entryStartIndex = lineText.indexOf(entry);
    const entryEndIndex = entryStartIndex + entry.length;

    return {
        disabled: isDisabled,
        entry,
        entryRange: new Range(
            new Position(lineIndex, entryStartIndex),
            new Position(lineIndex, entryEndIndex),
        ),
    };
};

const getFinalLinePattern = () =>
    new RegExp(
        `(${getPatternForDisabledLine()}|${getCommonPatternStartForEnabledLine()}$)`,
        "m",
    );
const getNonFinalArrayBlockLinePattern = () =>
    new RegExp(
        `(${getPatternForDisabledLine()}|${getCommonPatternStartForEnabledLine()},$)`,
        "m",
    );
const getCommonPatternStartForEnabledLine = () =>
    "^\\s*[a-zA-Z0-9-_\\\\.]*\\s*";
const getPatternForDisabledLine = () => "^\\s*~.*$";
