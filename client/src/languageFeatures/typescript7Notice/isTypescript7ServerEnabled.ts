import { extensions, workspace } from "vscode";

/**
 * Checks if the Typescript extension of VS Code delegates the language features for Javascript to the Typescript 7 (native) language server.
 * That server does not load Typescript server plugins, so the Javascript intellisense of this extension is not available then.
 *
 * Mirrors the check of the Typescript extension: The Typescript 7 server is only used if the setting is enabled and one of the Typescript 7 extensions is installed.
 */
export function isTypescript7ServerEnabled() {
    const config = workspace.getConfiguration();

    // The legacy setting is deprecated in favor of the unified one, but still respected by the Typescript extension.
    const isEnabledInSettings =
        config.get<boolean>("js/ts.experimental.useTsgo", false) === true ||
        config.get<boolean>("typescript.experimental.useTsgo", false) === true;

    return isEnabledInSettings && isTypescript7ExtensionInstalled();
}

/** The setting keys that control if the Typescript 7 server is used. */
export const typescript7SettingKeys = [
    "js/ts.experimental.useTsgo",
    "typescript.experimental.useTsgo",
];

// The ids are the same ones that the Typescript extension looks for.
const typescript7ExtensionIds = [
    "typescriptteam.vscode-typescript",
    "typescriptteam.vscode-typescript-nightly",
    "typescriptteam.native-preview",
];

function isTypescript7ExtensionInstalled() {
    return typescript7ExtensionIds.some((id) => extensions.getExtension(id));
}
