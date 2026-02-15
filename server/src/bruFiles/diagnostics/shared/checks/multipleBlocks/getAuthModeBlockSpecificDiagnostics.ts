import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../../../interfaces";
import {
    Block,
    isBlockDictionaryBlock,
    AuthModeBlockKey,
} from "@global_shared";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinAuthModeBlockDiagnosticCodeEnum";

export function getAuthModeBlockSpecificDiagnostics(
    filePath: string,
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
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            filePath,
            authBlock,
            RelevantWithinAuthModeBlockDiagnosticCode.DuplicateKeysDefinedInAuthModeBlock,
            mandatoryKeys,
        ) ?? []),
    );

    return diagnostics;
}
