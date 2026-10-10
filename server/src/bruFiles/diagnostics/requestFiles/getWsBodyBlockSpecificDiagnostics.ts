import {
    Block,
    BooleanFieldValue,
    DictionaryBlock,
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
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
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
        checkValueOfSingleDefinedField(
            block,
            WsBodyBlockKey.Type,
            Object.values(WsBodyBlockMessageType),
            RelevantWithinWsBodyBlockDiagnosticCode.TypeValueInvalid,
        ),
        checkValueOfSingleDefinedField(
            block,
            WsBodyBlockKey.Selected,
            Object.values(BooleanFieldValue),
            RelevantWithinWsBodyBlockDiagnosticCode.SelectedValueInvalid,
        ),
    ];
}

function checkValueOfSingleDefinedField(
    block: DictionaryBlock,
    key: string,
    validValues: string[],
    diagnosticCode: RelevantWithinWsBodyBlockDiagnosticCode,
) {
    const fieldsWithKey = block.content
        .filter(isDictionaryBlockSimpleField)
        .filter(({ key: k }) => k == key);

    // In case of duplicate definitions, it's ambiguous which one is meant. That case is reported by another check.
    return fieldsWithKey.length == 1
        ? checkValueForDictionaryBlockSimpleFieldIsValid(
              fieldsWithKey[0],
              validValues,
              diagnosticCode,
          )
        : undefined;
}
