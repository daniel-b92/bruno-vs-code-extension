import {
    RequestFileBlockName,
    shouldBeCodeBlock,
    shouldBeDictionaryBlock,
    BlockBracket,
} from "../../..";
import { BlockType } from "./blockTypeEnum";

export function getBlockType(blockStartingLine: string, blockName: string) {
    if (blockStartingLine.includes(BlockBracket.OpeningBracketForArrayBlock)) {
        return BlockType.Array;
    }

    if (shouldBeDictionaryBlock(blockName)) {
        return BlockType.Dictionary;
    }

    if (shouldBeCodeBlock(blockName)) {
        return BlockType.Code;
    }

    if (shouldBeJsonBlock(blockName)) {
        return BlockType.Json;
    }

    return BlockType.PlainText;
}

function shouldBeJsonBlock(blockName: string) {
    return blockName == RequestFileBlockName.JsonBody;
}
