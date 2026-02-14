import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
    Position,
} from "@global_shared";

export function getCodeBlockContainingPosition(
    bruFileContent: string,
    position: Position,
) {
    const blocksToCheck = getCodeBlocks(
        parseBruFile(new TextDocumentHelper(bruFileContent)).blocks,
    );

    return blocksToCheck.find(({ contentRange }) =>
        contentRange.contains(position),
    );
}
