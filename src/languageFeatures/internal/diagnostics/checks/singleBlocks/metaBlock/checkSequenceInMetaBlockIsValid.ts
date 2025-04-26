import { DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockField,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../../../shared";
import { getFieldFromDictionaryBlock } from "../../../util/getFieldFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { isSequenceValid } from "../../../util/isSequenceValid";

export function checkSequenceInMetaBlockIsValid(
    metaBlock: RequestFileBlock
): DiagnosticWithCode | undefined {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return undefined;
    }

    const sequenceField = getFieldFromDictionaryBlock(
        castedMetaBlock,
        MetaBlockKey.Sequence
    );

    if (sequenceField && !isSequenceValid(sequenceField)) {
        return getDiagnostic(sequenceField);
    } else {
        return undefined;
    }
}

function getDiagnostic(sequenceField: DictionaryBlockField) {
    return {
        message:
            "Sequence is not valid. It needs to be an integer with a value of at least 1.",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinMetaBlockDiagnosticCode.SequenceNotValid,
    };
}
