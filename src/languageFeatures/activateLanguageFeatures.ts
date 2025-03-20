import { ExtensionContext, languages, workspace } from "vscode";
import { provideBrunoLangCompletionItems } from "./brunoLanguage/provideBrunoLangCompletionItems";
import { provideBrunoLangDiagnostics } from "./brunoLanguage/diagnostics/provideBrunoLangDiagnostics";
import { dirname, extname } from "path";

export function activateLanguageFeatures(context: ExtensionContext) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(
        workspace.onDidChangeTextDocument((e) => {
            const isBrunoRequest =
                extname(e.document.uri.fsPath) == ".bru" &&
                !dirname(e.document.uri.fsPath).match(/environments(\/|\\)?/);

            if (isBrunoRequest) {
                provideBrunoLangDiagnostics(
                    diagnosticCollection,
                    e.document.getText(),
                    e.document.uri
                );
            }
        })
    );
}
