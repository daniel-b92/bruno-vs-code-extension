import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import * as vscode from "vscode";
import { BrunoTestData, getTestLabel } from "./testTreeHelper";

export function showHtmlReport(
    htmlReportPath: string,
    testData: BrunoTestData
) {
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    const panel = vscode.window.createWebviewPanel(
        "bruno HTML report",
        `bruno HTML report - ${getTestLabel(vscode.Uri.file(testData.path))}`,
        column || vscode.ViewColumn.One,
        { enableCommandUris: true, enableFindWidget: true, enableScripts: true }
    );

    panel.webview.html = readFileSync(htmlReportPath).toString();
}

export const getHtmlReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.html");
