import { Position as VsCodePosition } from "vscode";
import {
    mapToVsCodeRange,
    parseBruFile,
    TextDocumentHelper,
} from "../../../../shared";
import { getCodeBlocks } from "./getCodeBlocks";

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
