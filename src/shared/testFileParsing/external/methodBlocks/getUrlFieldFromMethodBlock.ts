import {
    RequestFileBlock,
    getAllMethodBlocks,
    castBlockToDictionaryBlock,
    MethodBlockKey,
} from "../../../../shared";

export function getUrlFieldFromMethodBlock(allBlocks: RequestFileBlock[]) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1) {
        return undefined;
    }

    const methodBlock = castBlockToDictionaryBlock(methodBlocks[0]);

    if (!methodBlock) {
        return undefined;
    }

    const urlFieldsInMethodBlock = methodBlock.content.filter(
        ({ key }) => key == MethodBlockKey.Url
    );

    return urlFieldsInMethodBlock.length == 1
        ? urlFieldsInMethodBlock[0]
        : undefined;
}
