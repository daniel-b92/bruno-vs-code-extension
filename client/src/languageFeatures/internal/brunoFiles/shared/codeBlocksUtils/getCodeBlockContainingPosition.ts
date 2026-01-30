import { Position as VsCodePosition } from "vscode";
import {
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";

export function getCodeBlockContainingPosition(
    bruFileContent: string,
    position: VsCodePosition,
) {
    const blocksToCheck = getCodeBlocks(
        parseBruFile(new TextDocumentHelper(bruFileContent)).blocks,
    );

    return blocksToCheck.find(({ contentRange }) =>
        mapToVsCodeRange(contentRange).contains(position),
    );
}
