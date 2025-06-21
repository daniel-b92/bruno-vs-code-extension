import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../definitions";
import {
    Block,
    castBlockToDictionaryBlock,
    AuthModeBlockKey,
} from "../../../../shared";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinAuthModeBlockDiagnosticCodeEnum";

export function getAuthModeBlockSpecificDiagnostics(
    authBlock: Block
): (DiagnosticWithCode | undefined)[] {
    const castedAuthBlock = castBlockToDictionaryBlock(authBlock);

    if (!castedAuthBlock) {
        return [];
    }

    const mandatoryKeys = Object.values(AuthModeBlockKey);
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    diagnostics.push(
        checkNoKeysAreMissingForDictionaryBlock(
            castedAuthBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.KeysMissingInAuthModeBlock
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            castedAuthBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.UnknownKeysDefinedInAuthModeBlock
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            castedAuthBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.DuplicateKeysDefinedInAuthModeBlock
        )
    );

    return diagnostics;
}
