import { AuthType, ParsedRequestFile } from "@global_shared";
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
    const { properties } = auth.value;
    const missingKeys: string[] = [];

    if (properties.type.value == AuthType.Basic) {
        const { username, password } = properties as {
            username?: unknown;
            password?: unknown;
        };
        missingKeys.push(
            ...(username ? [] : ["username"]),
            ...(password ? [] : ["password"]),
        );
    } else if (
        properties.type.value == AuthType.Bearer &&
        !(properties as { token?: unknown }).token
    ) {
        missingKeys.push("token");
    }

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
