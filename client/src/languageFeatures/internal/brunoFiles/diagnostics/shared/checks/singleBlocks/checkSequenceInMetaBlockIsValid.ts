import { DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockSimpleField,
    Block,
    MetaBlockKey,
    getFieldFromMetaBlock,
    mapToVsCodeRange,
    isDictionaryBlockSimpleField,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

export function checkSequenceInMetaBlockIsValid(
    metaBlock: Block,
): DiagnosticWithCode | undefined {
    const sequenceField = getFieldFromMetaBlock(
        metaBlock,
        MetaBlockKey.Sequence,
    );

    if (
        sequenceField &&
        isDictionaryBlockSimpleField(sequenceField) &&
        !doesDictionaryBlockFieldHaveValidIntegerValue(sequenceField, 1)
    ) {
        return getDiagnostic(sequenceField);
    } else {
        return undefined;
    }
}

function getDiagnostic(sequenceField: DictionaryBlockSimpleField) {
    return {
        message:
            "Sequence is not valid. It needs to be an integer with a value of at least 1.",
        range: mapToVsCodeRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinMetaBlockDiagnosticCode.SequenceNotValid,
    };
}
