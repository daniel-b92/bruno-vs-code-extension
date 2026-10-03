import { ParsedRequestFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

export function checkAuthHasRequiredFields(
    auth: NonNullable<
        ParsedRequestFile["properties"]["http"]
    >["properties"]["auth"],
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return undefined;
    }
    const { properties, missingProperties } = auth.value;
    const missingKeys = missingProperties.map(({ key }) => key);

    return missingKeys.length > 0
        ? {
              message: `Missing keys for auth type '${properties.type.value}': ${missingKeys
                  .map((key) => `'${key}'`)
                  .join(", ")}.`,
              range: properties.type.valueRange,
              // The keys are optional, so this is only a warning.
              severity: DiagnosticSeverity.Warning,
          }
        : undefined;
}
