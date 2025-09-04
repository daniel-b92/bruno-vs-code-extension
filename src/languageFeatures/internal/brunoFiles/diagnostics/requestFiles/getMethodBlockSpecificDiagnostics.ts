import {
    Block,
    castBlockToDictionaryBlock,
    MethodBlockKey,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMethodBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";

export function getMethodBlockSpecificDiagnostics(
    methodBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

    if (!castedMethodBlock) {
        return [];
    }

    const methodBlockKeys = Object.values(MethodBlockKey);

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            castedMethodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            castedMethodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            castedMethodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock,
        ),
    ];
}
