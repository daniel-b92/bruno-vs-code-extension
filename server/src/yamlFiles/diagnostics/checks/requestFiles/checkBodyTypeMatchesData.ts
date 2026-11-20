import { HttpBodyType, ParsedRequestFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { CommonDiagnosticParams } from "../../../interfaces";

// The data for the other body types (e.g. multipart forms) is not a plain string.
const typesRequiringStringData: HttpBodyType[] = [
    HttpBodyType.Json,
    HttpBodyType.Xml,
    HttpBodyType.Text,
    HttpBodyType.Sparql,
];

export function checkBodyTypeMatchesData(
    body: NonNullable<
        ParsedRequestFile["properties"]["http"]
    >["properties"]["body"],
    { filePath }: CommonDiagnosticParams,
): Diagnostic | undefined {
    const { type, data } = body?.properties ?? {};

    if (!body || !type) {
        return undefined;
    }

    if (type.value == HttpBodyType.None && data) {
        return {
            message: `A body is defined although the body type is '${HttpBodyType.None}'.`,
            range: data.keyRange,
            severity: DiagnosticSeverity.Warning,
            relatedInformation: [
                {
                    message: "Body type",
                    location: {
                        uri: URI.file(filePath).toString(),
                        range: type.valueRange,
                    },
                },
            ],
        };
    }

    return !data && typesRequiringStringData.includes(type.value)
        ? {
              message: `No body data is defined for the body type '${type.value}'.`,
              range: type.valueRange,
              severity: DiagnosticSeverity.Warning,
          }
        : undefined;
}
