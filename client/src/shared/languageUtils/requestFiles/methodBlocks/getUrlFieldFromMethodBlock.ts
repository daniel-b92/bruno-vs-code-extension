import { Block, MethodBlockKey } from "../../..";
import { getMethodBlockIfValid } from "./getMethodBlockIfValid";

export function getUrlFieldFromMethodBlock(allBlocks: Block[]) {
    const methodBlock = getMethodBlockIfValid(allBlocks);

    if (!methodBlock) {
        return undefined;
    }

    const urlFieldsInMethodBlock = methodBlock.content.filter(
        ({ key }) => key == MethodBlockKey.Url,
    );

    return urlFieldsInMethodBlock.length == 1
        ? urlFieldsInMethodBlock[0]
        : undefined;
}
