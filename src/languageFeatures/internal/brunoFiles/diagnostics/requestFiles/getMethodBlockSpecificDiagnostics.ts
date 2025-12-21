import {
    Block,
    isBlockDictionaryBlock,
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
    if (!isBlockDictionaryBlock(methodBlock)) {
        return [];
    }

    const methodBlockKeys = Object.values(MethodBlockKey);

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            methodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            methodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            methodBlock,
            methodBlockKeys,
            RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock,
        ),
    ];
}
