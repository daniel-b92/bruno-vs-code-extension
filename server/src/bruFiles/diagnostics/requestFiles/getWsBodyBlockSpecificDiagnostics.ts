import {
    Block,
    BooleanFieldValue,
    getMandatoryKeysForWsBodyBlock,
    getOptionalKeysForWsBodyBlock,
    isBlockDictionaryBlock,
    isDictionaryBlockSimpleField,
    WsBodyBlockKey,
    WsBodyBlockMessageType,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueOfSingleDefinedFieldIsValid } from "../shared/checks/singleBlocks/checkValueOfSingleDefinedFieldIsValid";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinWsBodyBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinWsBodyBlockDiagnosticCodeEnum";

/**
 * Websocket requests can have multiple body blocks (one per message).
 * The diagnostics need to be determined separately for each one of them.
 */
export function getWsBodyBlockSpecificDiagnostics(
    filePath: string,
    block: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(block)) {
        return [];
    }

    const mandatoryKeys = getMandatoryKeysForWsBodyBlock();
    const allKeys = [...mandatoryKeys, ...getOptionalKeysForWsBodyBlock()];
    const simpleFields = block.content.filter(isDictionaryBlockSimpleField);

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            block,
            mandatoryKeys,
            RelevantWithinWsBodyBlockDiagnosticCode.KeysMissingInWsBodyBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            block,
            allKeys,
            RelevantWithinWsBodyBlockDiagnosticCode.UnknownKeysDefinedInWsBodyBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock({
            filePath,
            block,
            diagnosticCode:
                RelevantWithinWsBodyBlockDiagnosticCode.DuplicateKeysDefinedInWsBodyBlock,
            expectedKeys: allKeys,
        }) ?? []),
        checkValueOfSingleDefinedFieldIsValid(
            simpleFields,
            WsBodyBlockKey.Type,
            Object.values(WsBodyBlockMessageType),
            RelevantWithinWsBodyBlockDiagnosticCode.TypeValueInvalid,
        ),
        checkValueOfSingleDefinedFieldIsValid(
            simpleFields,
            WsBodyBlockKey.Selected,
            Object.values(BooleanFieldValue),
            RelevantWithinWsBodyBlockDiagnosticCode.SelectedValueInvalid,
        ),
    ];
}
