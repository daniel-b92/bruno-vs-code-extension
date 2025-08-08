import { castBlockToDictionaryBlock } from "../..";
import { RequestFileBlockName } from "../../languageUtils/requestFiles/requestFileBlockNameEnum";
import { DictionaryBlock, Block } from "./interfaces";

export function getValidDictionaryBlocksWithName(
    allBlocks: Block[],
    dictionaryBlockName: RequestFileBlockName
): DictionaryBlock[] {
    const blocksWithName = allBlocks.filter(
        ({ name }) => name == dictionaryBlockName
    );

    return blocksWithName.length == 0
        ? []
        : blocksWithName
              .map((block) => castBlockToDictionaryBlock(block))
              .filter((block) => block != undefined);
}
