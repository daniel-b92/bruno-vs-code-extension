import {
    Block,
    isBlockDictionaryBlock,
    MethodBlockKey,
    RequestFileBlockName,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMethodBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";
import { Uri } from "vscode";

export function getMethodBlockSpecificDiagnostics(
    documentUri: Uri,
    methodBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(methodBlock)) {
        return [];
    }

    const mandatoryKeys = getMandatoryKeys(methodBlock.name);

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
            documentUri,
            methodBlock,
            RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock,
            mandatoryKeys,
        ) ?? []),
    ];
}

function getMandatoryKeys(blockName: string) {
    const allKeys = Object.values(MethodBlockKey);
    return blockName == RequestFileBlockName.Http
        ? allKeys
        : allKeys.filter((key) => key != MethodBlockKey.Method);
}
