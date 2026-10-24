import { ExtensionContext, ExtensionMode, workspace } from "vscode";
import { FeatureToggles } from "@global_shared";

const yamlSupportEnvVariable = "BRUNO_YAML_SUPPORT";

export const yamlSupportSettingsKey = "bru-as-code.yamlCollectionSupport";

export function getFeatureToggles(context: ExtensionContext): FeatureToggles {
    // The env variables are only respected in development mode, so that regular users can never activate the toggles.
    const isDevelopmentMode =
        context.extensionMode == ExtensionMode.Development;

    return {
        yamlCollectionSupport:
            workspace
                .getConfiguration()
                .get<boolean>(yamlSupportSettingsKey, false) ||
            (isDevelopmentMode &&
                process.env[yamlSupportEnvVariable] == "true"),
    };
}
