import { Position as VsCodePosition } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
    ItemType,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";

export function getCodeBlockContainingPosition(
    bruFileContent: string,
    position: VsCodePosition,
    itemType: ItemType,
) {
    const blocksToCheck = getCodeBlocks(
        parseBruFile(new TextDocumentHelper(bruFileContent), itemType).blocks,
    );

    return blocksToCheck.find(({ contentRange }) =>
        mapToVsCodeRange(contentRange).contains(position),
    );
}
