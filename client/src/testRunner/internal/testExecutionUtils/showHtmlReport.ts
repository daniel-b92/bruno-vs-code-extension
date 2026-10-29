import { promisify } from "util";
import { getTestLabel } from "../../testTreeUtils/testTreeHelper";
import { Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { readFile } from "fs";
import { checkIfPathExistsAsync } from "@global_shared";

let currentPanel: WebviewPanel | undefined;
let lastReport: { htmlReportPath: string; testItemPath: string } | undefined;

export async function showHtmlReport(
    htmlReportPath: string,
    testItemPath: string,
) {
    lastReport = { htmlReportPath, testItemPath };

    const title = `bru HTML report - ${getTestLabel(Uri.file(testItemPath))}`;
    const html = await promisify(readFile)(htmlReportPath, "utf-8");

    if (currentPanel) {
        // Reuse the existing panel to avoid piling up one panel per test run.
        currentPanel.title = title;
        currentPanel.webview.html = html;
        currentPanel.reveal();
        return;
    }

    const column = window.activeTextEditor
        ? window.activeTextEditor.viewColumn
        : undefined;

    const panel = window.createWebviewPanel(
        "bru HTML report",
        title,
        column || ViewColumn.One,
        {
            enableCommandUris: true,
            enableFindWidget: true,
            enableScripts: true,
            retainContextWhenHidden: true,
        },
    );
    panel.onDidDispose(() => {
        currentPanel = undefined;
    });
    currentPanel = panel;

    panel.webview.html = html;
}

export async function showLastHtmlReport() {
    if (
        !lastReport ||
        !(await checkIfPathExistsAsync(lastReport.htmlReportPath))
    ) {
        window.showInformationMessage(
            "No HTML report available yet. Run a test first (the setting 'bru-as-code.showHtmlReport' must not be set to 'never').",
        );
        return;
    }

    await showHtmlReport(lastReport.htmlReportPath, lastReport.testItemPath);
}
