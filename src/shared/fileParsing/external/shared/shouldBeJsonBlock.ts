import { RequestFileBlockName } from "../../..";

export function shouldBeJsonBlock(blockName: string) {
    return blockName == RequestFileBlockName.JsonBody;
}
