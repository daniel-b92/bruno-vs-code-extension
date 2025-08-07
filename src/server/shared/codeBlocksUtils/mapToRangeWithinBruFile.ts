import {
    Block,
    mapPosition,
    mapRange,
    OutputChannelLogger,
    Position,
    Range,
    RequestFileBlockName,
} from "../../../shared";
import { Range as VsCodeRange } from "vscode";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function mapToRangeWithinBruFile(
    blocksInBruFile: Block[],
    fullJsFileContent: string,
    rangeInJsFile: VsCodeRange,
    logger?: OutputChannelLogger
) {
    const start = mapToPositionWithinBruFile(
        blocksInBruFile,
        fullJsFileContent,
        rangeInJsFile.start
    );
    const end = mapToPositionWithinBruFile(
        blocksInBruFile,
        fullJsFileContent,
        rangeInJsFile.end
    );

    if (!start || !end) {
        logger?.error(
            `Could not determine start or end for range in Js file ${JSON.stringify(
                rangeInJsFile.start,
                null,
                2
            )}:${JSON.stringify(rangeInJsFile.end, null, 2)}`
        );
    }
    return start && end ? mapRange(new Range(start, end)) : undefined;
}

function mapToPositionWithinBruFile(
    blocksInBruFile: Block[],
    fullJsFileContent: string,
    positionInJsFile: Position
) {
    const blockInJsFileContainingPosition = getBlockFromJsFileWherePositionIsIn(
        blocksInBruFile,
        fullJsFileContent,
        positionInJsFile
    );

    if (!blockInJsFileContainingPosition) {
        return undefined;
    } else {
        const blockInBruFile = blocksInBruFile.find(
            ({ name }) => name == blockInJsFileContainingPosition.name
        ) as Block;

        const positionWithinBlock = mapPosition(positionInJsFile).translate(
            -blockInJsFileContainingPosition.range.start.line
        );

        return positionWithinBlock.translate(
            blockInBruFile.contentRange.start.line
        );
    }
}

function getBlockFromJsFileWherePositionIsIn(
    blocksInBruFile: Block[],
    fullJsFileContent: string,
    positionInJsFile: Position
) {
    const blocksWithJsCodeInBruFile = getCodeBlocks(blocksInBruFile);

    return (
        blocksWithJsCodeInBruFile
            .map(({ name }) => ({
                ...getTempJsFileBlockContent(
                    fullJsFileContent,
                    name as RequestFileBlockName
                ),
                name,
            }))
            .filter(
                ({ content, range }) =>
                    content != undefined && range != undefined
            ) as { name: RequestFileBlockName; content: string; range: Range }[]
    ).find(({ range }) =>
        mapRange(range).contains(mapPosition(positionInJsFile))
    );
}
