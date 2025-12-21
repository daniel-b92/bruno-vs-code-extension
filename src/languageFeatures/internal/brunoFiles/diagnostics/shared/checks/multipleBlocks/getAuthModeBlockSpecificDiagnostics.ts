import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import {
    Block,
    isBlockDictionaryBlock,
    AuthModeBlockKey,
} from "../../../../../../../shared";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinAuthModeBlockDiagnosticCodeEnum";

export function getAuthModeBlockSpecificDiagnostics(
    authBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(authBlock)) {
        return [];
    }

    const mandatoryKeys = Object.values(AuthModeBlockKey);
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    diagnostics.push(
        checkNoKeysAreMissingForDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.KeysMissingInAuthModeBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.UnknownKeysDefinedInAuthModeBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthModeBlockDiagnosticCode.DuplicateKeysDefinedInAuthModeBlock,
        ),
    );

    return diagnostics;
}
