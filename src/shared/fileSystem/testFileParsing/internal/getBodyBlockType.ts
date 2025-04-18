import { isBodyBlock } from "./isBodyBlock";

export function getBodyBlockType(blockName: string) {
    return isBodyBlock(blockName)
        ? blockName.substring("body:".length)
        : undefined;
}
