import { ParsedCollectionSettingsFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export function checkAuthIsNotInherited(
    auth: NonNullable<
        ParsedCollectionSettingsFile["properties"]["request"]
    >["properties"]["auth"],
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || "properties" in auth.value) {
        return undefined;
    }

    return {
        message:
            "Auth cannot be inherited in a collection settings file, because there is no parent to inherit from.",
        range: auth.valueRange,
        severity: DiagnosticSeverity.Error,
    };
}
