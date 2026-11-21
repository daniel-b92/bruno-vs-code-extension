import { extensions, workspace, WorkspaceConfiguration } from "vscode";

const unifiedSettingKey = "js/ts.experimental.useTsgo";
// Deprecated in favor of the unified setting, but still respected by the Typescript extension.
const legacySettingKey = "typescript.experimental.useTsgo";

/** The setting keys that control if the Typescript 7 server is used. */
export const typescript7SettingKeys = [unifiedSettingKey, legacySettingKey];

// The ids are the same ones that the Typescript extension looks for.
const typescript7ExtensionIds = [
    "typescriptteam.vscode-typescript",
    "typescriptteam.vscode-typescript-nightly",
    "typescriptteam.native-preview",
];

/**
 * Checks if the Typescript extension of VS Code delegates the language features for Javascript to the Typescript 7 (native) language server.
 * That server does not load Typescript server plugins, so the Javascript intellisense of this extension is not available then.
 *
 * Mirrors the check of the Typescript extension: The Typescript 7 server is only used if the setting is enabled and one of the Typescript 7 extensions is installed.
 * The unified setting takes precedence over the legacy one, but only if it was set explicitly.
 */
export function isTypescript7ServerEnabled() {
    const config = workspace.getConfiguration();

    const isEnabledInSettings =
        (getExplicitValue(config, unifiedSettingKey) ??
            getExplicitValue(config, legacySettingKey)) === true;

    return isEnabledInSettings && isTypescript7ExtensionInstalled();
}

function getExplicitValue(config: WorkspaceConfiguration, key: string) {
    const inspected = config.inspect<boolean>(key);

    return (
        inspected?.workspaceFolderValue ??
        inspected?.workspaceValue ??
        inspected?.globalValue
    );
}

function isTypescript7ExtensionInstalled() {
    return typescript7ExtensionIds.some((id) => extensions.getExtension(id));
}
