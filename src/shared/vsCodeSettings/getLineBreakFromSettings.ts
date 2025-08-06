import { platform } from "process";
import { workspace } from "vscode";

export function getLineBreakFromSettings() {
    const workspaceSetting = workspace
        .getConfiguration()
        .get<
            "\n" | "\r\n" | "auto"
        >("files.eol", getFallbackLineBreakDependingOnOs());

    return workspaceSetting != "auto"
        ? workspaceSetting
        : getFallbackLineBreakDependingOnOs();
}

function getFallbackLineBreakDependingOnOs() {
    return platform == "win32" ? "\r\n" : "\n";
}
