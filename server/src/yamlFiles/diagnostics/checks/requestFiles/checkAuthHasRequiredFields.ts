import { AuthType, OAuth2AuthProperty, ParsedAuth } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

// For these types, which keys are relevant depends on the used signature method.
const authTypesWithAllKeysOptional: AuthType[] = [AuthType.Oauth1];

export function checkAuthHasRequiredFields(
    auth: ParsedAuth | undefined,
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return undefined;
    }
    const { properties, missingProperties } = auth.value;
    if (authTypesWithAllKeysOptional.includes(properties.type.value)) {
        return undefined;
    }
    // For OAuth2, which other keys are relevant depends on the selected flow, so only the flow itself is required.
    const missingKeys = missingProperties
        .map(({ key }) => key)
        .filter(
            (key) =>
                properties.type.value != AuthType.Oauth2 ||
                key == OAuth2AuthProperty.Flow,
        );

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
