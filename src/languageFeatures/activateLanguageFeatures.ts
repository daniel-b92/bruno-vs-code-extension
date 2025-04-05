import {
    DiagnosticCollection,
    ExtensionContext,
    languages,
    TextDocument,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import { provideBrunoLangDiagnostics } from "./internal/diagnostics/provideBrunoLangDiagnostics";
import { dirname, extname } from "path";

export function activateLanguageFeatures(context: ExtensionContext) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        workspace.onDidOpenTextDocument((e) => {
            fetchDiagnostics(e, diagnosticCollection);
        })
    );

    context.subscriptions.push(
        workspace.onDidChangeTextDocument((e) => {
            fetchDiagnostics(e.document, diagnosticCollection);
        })
    );
}

function fetchDiagnostics(
    document: TextDocument,
    knownDiagnostics: DiagnosticCollection
) {
    const isBrunoRequest =
        extname(document.uri.fsPath) == ".bru" &&
        !dirname(document.uri.fsPath).match(/environments(\/|\\)?/);

    if (isBrunoRequest) {
        provideBrunoLangDiagnostics(
            knownDiagnostics,
            document.getText(),
            document.uri
        );
    }
}
