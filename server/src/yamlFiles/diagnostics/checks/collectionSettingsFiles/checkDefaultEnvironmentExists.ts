import { ParsedCollectionSettingsFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export function checkDefaultEnvironmentExists(
    defaultEnvironment: NonNullable<
        NonNullable<
            NonNullable<
                ParsedCollectionSettingsFile["properties"]["extensions"]
            >["properties"]["bruno"]
        >["properties"]["presets"]
    >["properties"]["defaultEnvironment"],
    knownEnvironmentNames: string[] | undefined,
): Diagnostic | undefined {
    if (
        !defaultEnvironment ||
        defaultEnvironment.value.trim().length == 0 ||
        !knownEnvironmentNames ||
        knownEnvironmentNames.includes(defaultEnvironment.value)
    ) {
        return undefined;
    }

    return {
        message: `Default environment '${defaultEnvironment.value}' does not exist in this collection.`,
        range: defaultEnvironment.valueRange,
        severity: DiagnosticSeverity.Warning,
    };
}
