import {
    Block,
    isBlockDictionaryBlock,
    BooleanFieldValue,
    isDictionaryBlockSimpleField,
    DictionaryBlock,
    getMandatoryKeysForApplockInRequestFile,
    appBlockInRequestFileKeys,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinAppBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinAppBlockDiagnosticCodeEnum";

export function getAppBlockSpecificDiagnostics(
    filePath: string,
    block: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(block)) {
        return [];
    }

    return runGenericChecksForAllFields(filePath, block).concat(
        runChecksForSpecificFields(block),
    );
}

function runGenericChecksForAllFields(
    filePath: string,
    block: DictionaryBlock,
) {
    const mandatoryKeys = getMandatoryKeysForApplockInRequestFile();

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            block,
            mandatoryKeys,
            RelevantWithinAppBlockDiagnosticCode.KeysMissingInAppBlock,
        ),
    ].concat(
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            block,
            mandatoryKeys,
            RelevantWithinAppBlockDiagnosticCode.UnknownKeysDefinedInAppBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock({
            filePath,
            block,
            diagnosticCode:
                RelevantWithinAppBlockDiagnosticCode.DuplicateKeysDefinedInAppBlock,
            expectedKeys: mandatoryKeys,
        }),
    );
}

function runChecksForSpecificFields(block: DictionaryBlock) {
    // All fields in the app block are simple dictionary fields.
    const matchingFields = block.content
        .filter(isDictionaryBlockSimpleField)
        .filter(({ key }) => key == appBlockInRequestFileKeys.Enabled);

    return matchingFields.length == 1
        ? checkValueForDictionaryBlockSimpleFieldIsValid(
              matchingFields[0],
              Object.values(BooleanFieldValue),
              RelevantWithinAppBlockDiagnosticCode.EnabledValueInvalid,
          )
        : undefined;
}
