import {
    Block,
    castBlockToDictionaryBlock,
    MethodBlockKey,
} from "../../sharedred";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMethodBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";

export function getMethodBlockSpecificDiagnostics(
    methodBlock: Block
): (DiagnosticWithCode | undefined)[] {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);
    const methodBlockKeys = Object.values(MethodBlockKey);

    return [
        castedMethodBlock
            ? checkNoKeysAreMissingForDictionaryBlock(
                  castedMethodBlock,
                  methodBlockKeys,
                  RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock
              )
            : undefined,
        castedMethodBlock
            ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                  castedMethodBlock,
                  methodBlockKeys,
                  RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock
              )
            : undefined,
        castedMethodBlock
            ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                  castedMethodBlock,
                  methodBlockKeys,
                  RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock
              )
            : undefined,
    ];
}
