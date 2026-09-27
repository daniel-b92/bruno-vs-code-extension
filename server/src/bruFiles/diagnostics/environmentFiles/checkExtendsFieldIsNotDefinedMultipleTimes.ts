import { EnvironmentFileExtendsField } from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export function checkExtendsFieldIsNotDefinedMultipleTimes(
    filePath: string,
    extendsFields: EnvironmentFileExtendsField[],
): DiagnosticWithCode[] | undefined {
    if (extendsFields.length <= 1) {
        return undefined;
    }

    const [firstOccurrence, ...duplicateOccurrences] = extendsFields;

    return duplicateOccurrences.map(({ keyRange }) => ({
        message: "The 'extends' field may not be defined multiple times.",
        range: keyRange,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinEnvironmentFileDiagnosticCode.ExtendsFieldDefinedMultipleTimes,
        relatedInformation: [
            {
                message: "First definition of the 'extends' field",
                location: {
                    uri: URI.file(filePath).toString(),
                    range: firstOccurrence.keyRange,
                },
            },
        ],
    }));
}
