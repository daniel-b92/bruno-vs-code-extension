import { Block, DictionaryBlock, TextDocumentHelper } from "@global_shared";
import { DiagnosticWithCode } from "../../interfaces";
import { checkAnnotationsAreValid } from "./multipleBlocks/checkAnnotationsAreValid";
import { checkDictionaryBlocksAreNotEmpty } from "./multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkDictionaryBlocksTypeAnnotationsMatchData } from "./multipleBlocks/checkDictionaryBlocksTypeAnnotationsMatchData";
import { checkDictionaryBlocksMultilineStringsAreValid } from "./multipleBlocks/checkDictionaryBlocksMultilineStringsAreValid";

export function runDictionaryBlocksBaseChecks(
    shouldBeDictionaryBlocks: Block[],
    validDictionaryBlocks: DictionaryBlock[],
    documentHelper: TextDocumentHelper,
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
        checkDictionaryBlocksMultilineStringsAreValid(
            documentHelper,
            validDictionaryBlocks,
        ),
    );
}
