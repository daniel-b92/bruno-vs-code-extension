import { LineBreakType } from "@global_shared";
import { platform } from "process";
import { workspace } from "vscode";

export function getLineBreakFromSettings() {
    const workspaceSetting = workspace
        .getConfiguration()
        .get<
            LineBreakType.Lf | LineBreakType.Crlf | "auto"
        >("files.eol", getFallbackLineBreakDependingOnOs());

    return workspaceSetting != "auto"
        ? workspaceSetting
        : getFallbackLineBreakDependingOnOs();
}

function getFallbackLineBreakDependingOnOs() {
    return platform == "win32" ? LineBreakType.Crlf : LineBreakType.Lf;
}
