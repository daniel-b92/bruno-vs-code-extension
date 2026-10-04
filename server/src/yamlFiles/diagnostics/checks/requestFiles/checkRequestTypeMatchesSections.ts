import { FileInfoType, ParsedRequestFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { CommonDiagnosticParams } from "../../../interfaces";

export function checkRequestTypeMatchesSections(
    { info, requestTypeSections }: ParsedRequestFile["properties"],
    { filePath }: CommonDiagnosticParams,
): Diagnostic[] {
    const type = info?.properties.type;

    if (
        !type ||
        type.value == FileInfoType.Folder ||
        // Request files cannot be of type `app`. That is reported by a separate check.
        type.value == FileInfoType.App
    ) {
        return [];
    }

    const nonMatchingSections = requestTypeSections.filter(
        ({ name }) => name != type.value,
    );
    const hasMatchingSection =
        requestTypeSections.length > nonMatchingSections.length;

    const relatedInformation = (
        sections: typeof requestTypeSections,
    ): Diagnostic["relatedInformation"] =>
        sections.map(({ name, keyRange }) => ({
            message: `Section '${name}'`,
            location: { uri: URI.file(filePath).toString(), range: keyRange },
        }));

    return [
        ...(hasMatchingSection
            ? []
            : [
                  {
                      message: `Request type '${type.value}' requires a '${type.value}' section.`,
                      range: type.valueRange,
                      severity: DiagnosticSeverity.Warning,
                      relatedInformation:
                          relatedInformation(nonMatchingSections),
                  },
              ]),
        ...nonMatchingSections.map(({ name, keyRange }) => ({
            message: `Section '${name}' does not match the request type '${type.value}'.`,
            range: keyRange,
            severity: DiagnosticSeverity.Warning,
            relatedInformation: [
                {
                    message: "Request type",
                    location: {
                        uri: URI.file(filePath).toString(),
                        range: type.valueRange,
                    },
                },
            ],
        })),
    ];
}
