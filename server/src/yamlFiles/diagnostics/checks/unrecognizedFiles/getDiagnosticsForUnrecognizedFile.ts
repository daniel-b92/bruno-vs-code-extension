import {
    FileInfoType,
    getRawInfoTypeFromYamlContent,
    Position,
    Range,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";

const supportedTypes = [
    FileInfoType.Http,
    FileInfoType.Graphql,
    FileInfoType.Grpc,
    FileInfoType.Websocket,
    FileInfoType.App,
];

/**
 * For yaml files within a collection that are not recognized as any specific Bruno file type (e.g. because of a missing or invalid `info.type`).
 * Makes transparent that the file is currently ignored by Bruno.
 */
export function getDiagnosticsForUnrecognizedFile({
    docHelper,
}: CommonDiagnosticParams): Diagnostic[] {
    const rawType = getRawInfoTypeFromYamlContent(docHelper.getText());

    if (!rawType) {
        // Hint only, since the file might also be unrelated to Bruno (e.g. an OpenAPI spec).
        return [
            {
                message:
                    "This file is not recognized as a Bruno file (no valid 'info.type'). It is ignored by Bruno.",
                range: new Range(new Position(0, 0), new Position(0, 0)),
                severity: DiagnosticSeverity.Hint,
            },
        ];
    }
    const start = docHelper.getPositionForOffset(
        new Position(0, 0),
        rawType.startOffset,
    );
    const end = docHelper.getPositionForOffset(
        new Position(0, 0),
        rawType.endOffset,
    );

    return [
        {
            message: `Unsupported 'info.type' '${rawType.value}'. Expected one of: ${supportedTypes.join(", ")}. The file is ignored by Bruno.`,
            range:
                start && end
                    ? new Range(start, end)
                    : new Range(new Position(0, 0), new Position(0, 0)),
            severity: DiagnosticSeverity.Information,
        },
    ];
}
