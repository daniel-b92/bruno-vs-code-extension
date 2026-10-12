import { Position as VsCodePosition } from "vscode";
import {
    CollectionFormat,
    ItemType,
    getJsCodeBlocksFromFile,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";

export function getCodeBlockContainingPosition(
    fileContent: string,
    position: VsCodePosition,
    itemType: ItemType,
    format: CollectionFormat,
) {
    return getJsCodeBlocksFromFile(fileContent, itemType, format).blocks.find(
        ({ contentRange }) => mapToVsCodeRange(contentRange).contains(position),
    );
}
