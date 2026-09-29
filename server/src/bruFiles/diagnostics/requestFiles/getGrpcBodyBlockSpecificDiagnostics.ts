import {
    Block,
    GrpcBodyBlockKey,
    isBlockDictionaryBlock,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinGrpcBodyBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinGrpcBodyBlockDiagnosticCodeEnum";

export function getGrpcBodyBlockSpecificDiagnostics(
    filePath: string,
    block: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(block)) {
        return [];
    }

    const expectedKeys = Object.values(GrpcBodyBlockKey);

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            block,
            expectedKeys,
            RelevantWithinGrpcBodyBlockDiagnosticCode.KeysMissingInGrpcBodyBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            block,
            expectedKeys,
            RelevantWithinGrpcBodyBlockDiagnosticCode.UnknownKeysDefinedInGrpcBodyBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock({
            filePath,
            block,
            diagnosticCode:
                RelevantWithinGrpcBodyBlockDiagnosticCode.DuplicateKeysDefinedInGrpcBodyBlock,
            expectedKeys,
        }) ?? []),
    ];
}
