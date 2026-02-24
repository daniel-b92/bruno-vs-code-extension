import {
    DictionaryBlockSimpleField,
    Block,
    MetaBlockKey,
    getActiveFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkSequenceInMetaBlockIsValid(
    metaBlock: Block,
): DiagnosticWithCode | undefined {
    const sequenceField = getActiveFieldFromMetaBlock(
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
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinMetaBlockDiagnosticCode.SequenceNotValid,
    };
}
