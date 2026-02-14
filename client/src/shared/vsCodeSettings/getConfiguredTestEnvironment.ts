import { getEnvironmentSettingsKey } from "@global_shared";
import { workspace } from "vscode";

export function getConfiguredTestEnvironment() {
    return workspace
        .getConfiguration()
        .get<string>(getEnvironmentSettingsKey());
}
