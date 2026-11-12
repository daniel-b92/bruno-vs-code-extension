import { AuthType, ParsedAuth, YamlMapDescriptor } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

// For these types, which keys are relevant depends on the used signature method (OAuth1) or flow (OAuth2).
// For OAuth2, the flow is the only mandatory key, so a missing flow is already reported by the parser.
const authTypesWithoutRequiredFieldsCheck: AuthType[] = [
    AuthType.Oauth1,
    AuthType.Oauth2,
];

export function checkAuthHasRequiredFields(
    auth: ParsedAuth | undefined,
    mapDescriptors: YamlMapDescriptor[],
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return undefined;
    }
    const { properties } = auth.value;
    if (authTypesWithoutRequiredFieldsCheck.includes(properties.type.value)) {
        return undefined;
    }
    // The auth map is the one that defines the `type` key at the position of the parsed type.
    const authMapDescriptor = mapDescriptors.find(({ definedKeys }) =>
        definedKeys.some(
            ({ key, keyRange }) =>
                key == "type" && keyRange.equals(properties.type.keyRange),
        ),
    );
    if (!authMapDescriptor) {
        return undefined;
    }
    const definedKeys = authMapDescriptor.definedKeys.map(({ key }) => key);
    const missingKeys = authMapDescriptor.expectedKeys
        .map(({ key }) => key)
        .filter((key) => !definedKeys.includes(key));

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
