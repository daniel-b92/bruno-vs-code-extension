import { isBodyBlock } from "./isBodyBlock";

export function getBodyTypeFromBlockName(blockName: string) {
    return isBodyBlock(blockName)
        ? blockName.substring("body:".length)
        : undefined;
}
