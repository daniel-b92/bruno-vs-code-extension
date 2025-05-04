import { castBlockToDictionaryBlock } from "../..";
import { RequestFileBlockName } from "../../languageUtils/requestFileBlockNameEnum";
import { DictionaryBlock, RequestFileBlock } from "./interfaces";

export function getValidDictionaryBlocksWithName(
    allBlocks: RequestFileBlock[],
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
