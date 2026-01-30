import { Block } from "@global_shared";
import { mapToVsCodeRange, OutputChannelLogger } from "@shared";
import { Range as VsCodeRange, Position as VsCodePosition } from "vscode";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function mapToRangeWithinBruFile(
    blockInBruFile: Block,
    fullJsFileContent: string,
    rangeInJsFile: VsCodeRange,
    logger?: OutputChannelLogger,
) {
    const start = mapToPositionWithinBruFile(
        blockInBruFile,
        fullJsFileContent,
        rangeInJsFile.start,
    );
    const end = mapToPositionWithinBruFile(
        blockInBruFile,
        fullJsFileContent,
        rangeInJsFile.end,
    );

    if (!start || !end) {
        logger?.error(
            `Could not determine start or end for range in Js file ${JSON.stringify(
                rangeInJsFile.start,
                null,
                2,
            )}:${JSON.stringify(rangeInJsFile.end, null, 2)}`,
        );
    }
    return start && end ? new VsCodeRange(start, end) : undefined;
}

function mapToPositionWithinBruFile(
    blockInBruFile: Block,
    fullJsFileContent: string,
    positionInJsFile: VsCodePosition,
) {
    const blockInJsFileContainingPosition = getBlockFromJsFileWherePositionIsIn(
        blockInBruFile,
        fullJsFileContent,
        positionInJsFile,
    );

    if (!blockInJsFileContainingPosition) {
        return undefined;
    }

    const positionWithinBlock = positionInJsFile.translate(
        -blockInJsFileContainingPosition.range.start.line,
    );

    return positionWithinBlock.translate(
        blockInBruFile.contentRange.start.line,
    );
}

function getBlockFromJsFileWherePositionIsIn(
    blockInBruFile: Block,
    fullJsFileContent: string,
    positionInJsFile: VsCodePosition,
) {
    const tempJsFileBlock = getTempJsFileBlockContent(
        fullJsFileContent,
        blockInBruFile.name,
    );

    return tempJsFileBlock &&
        mapToVsCodeRange(tempJsFileBlock.range).contains(positionInJsFile)
        ? tempJsFileBlock
        : undefined;
}
