import { promisify } from "util";
import { getTestLabel } from "../../testTreeUtils/testTreeHelper";
import { Uri, ViewColumn, window } from "vscode";
import { readFile } from "fs";

export async function showHtmlReport(
    htmlReportPath: string,
    testItemPath: string,
) {
    const column = window.activeTextEditor
        ? window.activeTextEditor.viewColumn
        : undefined;

    const panel = window.createWebviewPanel(
        "bru HTML report",
        `bru HTML report - ${getTestLabel(Uri.file(testItemPath))}`,
        column || ViewColumn.One,
        {
            enableCommandUris: true,
            enableFindWidget: true,
            enableScripts: true,
            retainContextWhenHidden: true,
        },
    );

    panel.webview.html = await promisify(readFile)(htmlReportPath, "utf-8");
}
