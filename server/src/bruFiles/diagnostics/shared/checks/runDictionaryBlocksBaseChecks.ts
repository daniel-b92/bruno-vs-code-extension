import { Block, DictionaryBlock } from "@global_shared";
import { DiagnosticWithCode } from "../../interfaces";
import { checkAnnotationsAreValid } from "./multipleBlocks/checkAnnotationsAreValid";
import { checkDictionaryBlocksAreNotEmpty } from "./multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkDictionaryBlocksTypeAnnotationsMatchData } from "./multipleBlocks/checkDictionaryBlocksTypeAnnotationsMatchData";

export function runDictionaryBlocksBaseChecks(
    shouldBeDictionaryBlocks: Block[],
    validDictionaryBlocks: DictionaryBlock[],
    filePath: string,
) {
    return ([] as (DiagnosticWithCode | undefined)[]).concat(
        validDictionaryBlocks.length < shouldBeDictionaryBlocks.length
            ? checkDictionaryBlocksHaveDictionaryStructure(
                  filePath,
                  shouldBeDictionaryBlocks,
              )
            : undefined,
        checkDictionaryBlocksAreNotEmpty(filePath, shouldBeDictionaryBlocks),
        checkAnnotationsAreValid(validDictionaryBlocks),
        checkDictionaryBlocksTypeAnnotationsMatchData(
            filePath,
            validDictionaryBlocks,
        ),
    );
}
