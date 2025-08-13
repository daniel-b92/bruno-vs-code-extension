import {
    shouldBeCodeBlock,
    shouldBeDictionaryBlock,
    shouldBeJsonBlock,
} from "../../..";
import { BlockBracket } from "../../internal/util/blockBracketEnum";
import { BlockType } from "../../internal/util/BlockTypeEnum";

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
