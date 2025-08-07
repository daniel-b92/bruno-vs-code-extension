import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import {
    Block,
    castBlockToDictionaryBlock,
    AuthModeBlockKey,
} from "../../../../sharedred";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinAuthModeBlockDiagnosticCodeEnum";

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
