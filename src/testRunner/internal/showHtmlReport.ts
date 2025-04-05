import { readFileSync } from "fs";
import { getTestLabel } from "../testTreeUtils/testTreeHelper";
import { Uri, ViewColumn, window } from "vscode";

export function showHtmlReport(htmlReportPath: string, testItemPath: string) {
    const column = window.activeTextEditor
        ? window.activeTextEditor.viewColumn
        : undefined;

    const panel = window.createWebviewPanel(
        "bruno HTML report",
        `bruno HTML report - ${getTestLabel(Uri.file(testItemPath))}`,
        column || ViewColumn.One,
        {
            enableCommandUris: true,
            enableFindWidget: true,
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    panel.webview.html = readFileSync(htmlReportPath).toString();
}
