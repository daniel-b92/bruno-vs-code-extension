import {
    DiagnosticCollection,
    ExtensionContext,
    languages,
    TextDocument,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import { provideBrunoLangDiagnostics } from "./internal/diagnostics/provideBrunoLangDiagnostics";
import { basename, dirname, extname } from "path";
import { isCollectionRootDir } from "../shared";

export function activateLanguageFeatures(context: ExtensionContext) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        workspace.onDidOpenTextDocument(async (e) => {
            await fetchDiagnostics(e, diagnosticCollection);
        })
    );

    context.subscriptions.push(
        workspace.onDidChangeTextDocument(async (e) => {
            await fetchDiagnostics(e.document, diagnosticCollection);
        })
    );
}

async function fetchDiagnostics(
    document: TextDocument,
    knownDiagnostics: DiagnosticCollection
) {
    const path = document.uri.fsPath;

    const isBrunoRequest =
        extname(path) == ".bru" &&
        !dirname(path).match(/environments(\/|\\)?/) &&
        basename(path) != "folder.bru" &&
        (basename(path) != "collection.bru" ||
            !(await isCollectionRootDir(dirname(path))));

    if (isBrunoRequest) {
        provideBrunoLangDiagnostics(
            knownDiagnostics,
            document.getText(),
            document.uri
        );
    }
}
