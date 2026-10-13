import { JsCodeBlock } from "@global_shared";
import { mapToVsCodeRange, OutputChannelLogger } from "@shared";
import { Range as VsCodeRange, Position as VsCodePosition } from "vscode";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function mapToRangeWithinSourceFile(
    blockInSourceFile: Pick<JsCodeBlock, "name" | "contentRange">,
    fullJsFileContent: string,
    rangeInJsFile: VsCodeRange,
    logger?: OutputChannelLogger,
) {
    const start = mapToPositionWithinSourceFile(
        blockInSourceFile,
        fullJsFileContent,
        rangeInJsFile.start,
    );
    const end = mapToPositionWithinSourceFile(
        blockInSourceFile,
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

function mapToPositionWithinSourceFile(
    blockInSourceFile: Pick<JsCodeBlock, "name" | "contentRange">,
    fullJsFileContent: string,
    positionInJsFile: VsCodePosition,
) {
    const blockInJsFileContainingPosition = getBlockFromJsFileWherePositionIsIn(
        blockInSourceFile,
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
        blockInSourceFile.contentRange.start.line,
    );
}

function getBlockFromJsFileWherePositionIsIn(
    blockInSourceFile: Pick<JsCodeBlock, "name" | "contentRange">,
    fullJsFileContent: string,
    positionInJsFile: VsCodePosition,
) {
    const tempJsFileBlock = getTempJsFileBlockContent(
        fullJsFileContent,
        blockInSourceFile.name,
    );

    return tempJsFileBlock &&
        mapToVsCodeRange(tempJsFileBlock.range).contains(positionInJsFile)
        ? tempJsFileBlock
        : undefined;
}
