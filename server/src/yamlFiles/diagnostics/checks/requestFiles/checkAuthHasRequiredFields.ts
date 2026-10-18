import {
    AuthType,
    OAuth2AuthProperty,
    ParsedAuth,
    YamlMapDescriptor,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

// For these types, which keys are relevant depends on the used signature method.
const authTypesWithAllKeysOptional: AuthType[] = [AuthType.Oauth1];

export function checkAuthHasRequiredFields(
    auth: ParsedAuth | undefined,
    mapDescriptors: YamlMapDescriptor[],
): Diagnostic | undefined {
    // Auth that is inherited has no properties.
    if (!auth || !("properties" in auth.value)) {
        return undefined;
    }
    const { properties } = auth.value;
    if (authTypesWithAllKeysOptional.includes(properties.type.value)) {
        return undefined;
    }
    // The auth map is the one that defines the `type` key at the position of the parsed type.
    const authMapDescriptor = mapDescriptors.find(({ definedKeys }) =>
        definedKeys.some(
            ({ key, keyRange }) =>
                key == "type" &&
                keyRange.equals(properties.type.keyRange),
        ),
    );
    if (!authMapDescriptor) {
        return undefined;
    }
    const definedKeys = authMapDescriptor.definedKeys.map(({ key }) => key);
    // For OAuth2, which other keys are relevant depends on the selected flow, so only the flow itself is required.
    const missingKeys = authMapDescriptor.expectedKeys
        .map(({ key }) => key)
        .filter((key) => !definedKeys.includes(key))
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
