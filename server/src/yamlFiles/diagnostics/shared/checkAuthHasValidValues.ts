import { AuthType, ParsedAuth } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

/**
 * Values restricted to a fixed set (e.g. placements) or to a type (e.g. booleans) are already validated while parsing.
 * This only checks the remaining value constraints.
 */
export function checkAuthHasValidValues(
    auth: ParsedAuth | undefined,
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return undefined;
    }
    const { properties } = auth.value;

    if (
        properties.type.value != AuthType.AkamaiEdgegrid ||
        !("maxBodySize" in properties)
    ) {
        return undefined;
    }
    const { maxBodySize } = properties;

    return maxBodySize &&
        !(Number.isInteger(maxBodySize.value) && maxBodySize.value >= 0)
        ? {
              message: "Only non-negative integer values are allowed.",
              range: maxBodySize.valueRange,
              severity: DiagnosticSeverity.Error,
          }
        : undefined;
}
