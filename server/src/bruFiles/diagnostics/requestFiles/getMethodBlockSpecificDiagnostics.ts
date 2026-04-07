import {
    Block,
    getMandatoryKeysForMethodBlock,
    isBlockDictionaryBlock,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinMethodBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";

export function getMethodBlockSpecificDiagnostics(
    filePath: string,
    methodBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(methodBlock)) {
        return [];
    }

    const mandatoryKeys = getMandatoryKeysForMethodBlock(methodBlock.name);

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            methodBlock,
            mandatoryKeys,
            RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            methodBlock,
            mandatoryKeys,
            RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            filePath,
            methodBlock,
            RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock,
            mandatoryKeys,
        ) ?? []),
    ];
}
