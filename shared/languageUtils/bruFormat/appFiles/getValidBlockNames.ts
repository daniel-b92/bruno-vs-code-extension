import { RequestFileBlockName } from "../../..";
import { appFileSpecificBlocks } from "./appFileSpecificBlocks";

export function getValidBlockNames(): string[] {
    return [RequestFileBlockName.Meta, appFileSpecificBlocks.app];
}
