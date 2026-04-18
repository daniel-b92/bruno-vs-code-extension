import {
    RequestFileBlockName,
    shouldBeCodeBlock,
    shouldBeDictionaryBlock,
    shouldBeArrayBlock,
} from "../../..";
import { BlockType } from "./blockTypeEnum";

export function getBlockType(blockName: string) {
    if (shouldBeArrayBlock(blockName)) {
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
