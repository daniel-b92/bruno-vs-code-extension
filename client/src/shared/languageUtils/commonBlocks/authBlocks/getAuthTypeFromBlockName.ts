import { isAuthBlock } from "../../..";

export function getAuthTypeFromBlockName(blockName: string) {
    return isAuthBlock(blockName)
        ? blockName.substring("auth:".length)
        : undefined;
}
