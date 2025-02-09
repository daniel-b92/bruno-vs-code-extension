import { readFileSync } from "fs";
import { BrunoTestData, getTestLabel } from "../testTreeHelper";
import { Uri, ViewColumn, window } from "vscode";

export function showHtmlReport(
    htmlReportPath: string,
    testData: BrunoTestData
) {
    const column = window.activeTextEditor
        ? window.activeTextEditor.viewColumn
        : undefined;

    const panel = window.createWebviewPanel(
        "bruno HTML report",
        `bruno HTML report - ${getTestLabel(Uri.file(testData.path))}`,
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
