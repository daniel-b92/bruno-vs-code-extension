import { workspace } from "vscode";
import { getEnvironmentSettingsKey } from "./getEnvironmentSettingsKey";

export function getConfiguredTestEnvironment() {
    return workspace
        .getConfiguration()
        .get<string>(getEnvironmentSettingsKey());
}
