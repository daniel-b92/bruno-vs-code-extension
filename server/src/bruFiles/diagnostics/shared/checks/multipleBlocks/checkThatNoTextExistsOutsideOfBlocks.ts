import {
    EnvironmentFileBlockName,
    getBlockStartPatternByName,
    getNonBlockSpecificBlockStartPattern,
    Position,
    Range,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    TextOutsideOfBlocks,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkThatNoTextExistsOutsideOfBlocks(
    filePath: string,
    allTextOutsideOfBlocks: TextOutsideOfBlocks[],
    allowedTopLevelFieldNames: string[] = [],
): DiagnosticWithCode | undefined {
    const allowedFieldLinePattern =
        allowedTopLevelFieldNames.length > 0
            ? new RegExp(
                  `^\\s*(${allowedTopLevelFieldNames.join("|")})\\s*:.*$`,
              )
            : undefined;

    const relevantRanges = allTextOutsideOfBlocks.flatMap((chunk) =>
        getInvalidLineGroupsWithinChunk(chunk, allowedFieldLinePattern),
    );

    if (relevantRanges.length == 0) {
        return undefined;
    } else {
        relevantRanges.sort(
            ({ start: { line: line1 } }, { start: { line: line2 } }) =>
                line1 - line2,
        );

        const range = new Range(
            relevantRanges[0].start,
            relevantRanges[relevantRanges.length - 1].end,
        );

        const diagnostic: DiagnosticWithCode = {
            message: getMessage(allTextOutsideOfBlocks, relevantRanges[0]),
            range,
            relatedInformation:
                relevantRanges.length > 1
                    ? relevantRanges.map((range) => ({
                          message: `Text outside of blocks`,
                          location: {
                              uri: filePath,
                              range: range,
                          },
                      }))
                    : undefined,
            severity: DiagnosticSeverity.Error,
            code: NonBlockSpecificDiagnosticCode.TextOutsideOfBlocks,
        };

        return diagnostic;
    }
}

function getInvalidLineGroupsWithinChunk(
    chunk: TextOutsideOfBlocks,
    allowedFieldLinePattern: RegExp | undefined,
): Range[] {
    const lines = chunk.text.split(/\r\n|\n/);
    const isLineValid = (line: string) =>
        /^\s*$/.test(line) ||
        (allowedFieldLinePattern != undefined &&
            allowedFieldLinePattern.test(line));

    const result: Range[] = [];
    let currentGroupStart: number | undefined;

    for (let lineOffset = 0; lineOffset < lines.length; lineOffset++) {
        if (isLineValid(lines[lineOffset])) {
            if (currentGroupStart != undefined) {
                result.push(
                    buildRangeForLineGroup(
                        chunk,
                        lines,
                        currentGroupStart,
                        lineOffset - 1,
                    ),
                );
                currentGroupStart = undefined;
            }

            continue;
        }

        if (currentGroupStart == undefined) {
            currentGroupStart = lineOffset;
        }
    }

    if (currentGroupStart != undefined) {
        result.push(
            buildRangeForLineGroup(
                chunk,
                lines,
                currentGroupStart,
                lines.length - 1,
            ),
        );
    }

    return result;
}

function buildRangeForLineGroup(
    chunk: TextOutsideOfBlocks,
    lines: string[],
    startLineOffset: number,
    endLineOffset: number,
): Range {
    const startCharacter =
        startLineOffset == 0 ? chunk.range.start.character : 0;
    const endCharacter =
        endLineOffset == lines.length - 1
            ? chunk.range.end.character
            : lines[endLineOffset].length;

    return new Range(
        new Position(chunk.range.start.line + startLineOffset, startCharacter),
        new Position(chunk.range.start.line + endLineOffset, endCharacter),
    );
}

function getMessage(
    allTextOutsideOfBlocks: TextOutsideOfBlocks[],
    firstInvalidRange: Range,
) {
    const commonMessage = "Text outside of blocks is not allowed.";

    const firstLineContent = getLineContentForChunks(
        allTextOutsideOfBlocks,
        firstInvalidRange.start.line,
    );

    const firstLineContainsBlockStart =
        firstLineContent != undefined
            ? getNonBlockSpecificBlockStartPattern().test(firstLineContent)
            : false;

    if (!firstLineContainsBlockStart) {
        return commonMessage;
    }

    const blockWithStartMatchingFirstLine = (
        Object.values(RequestFileBlockName) as string[]
    )
        .concat(Object.values(SettingsFileSpecificBlock))
        .concat(Object.values(EnvironmentFileBlockName))
        .find((blockName) =>
            getBlockStartPatternByName(blockName).test(
                firstLineContent as string,
            ),
        );

    return blockWithStartMatchingFirstLine
        ? `${commonMessage} Are you maybe missing a bracket for closing the block '${blockWithStartMatchingFirstLine}'?`
        : commonMessage;
}

function getLineContentForChunks(
    chunks: TextOutsideOfBlocks[],
    lineNumber: number,
): string | undefined {
    const containingChunk = chunks.find(
        ({ range }) =>
            range.start.line <= lineNumber && lineNumber <= range.end.line,
    );

    return containingChunk?.text.split(/\r\n|\n/)[
        lineNumber - containingChunk.range.start.line
    ];
}
