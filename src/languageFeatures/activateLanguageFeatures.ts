import {
    ExtensionContext,
    languages,
    Position,
    Range,
    TextDocument,
    TextEditorEdit,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    CollectionItemProvider,
    getExpectedUrlQueryParamsForQueryParamsBlock,
    getQueryParamsFromUrl,
    getUrlFieldFromMethodBlock,
    getUrlSubstringForQueryParams,
    getValidDictionaryBlocksWithName,
    parseTestFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/util/isBrunoRequestFile";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";

export function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: CollectionItemProvider
) {
    provideBrunoLangCompletionItems();

    const diagnosticCollection = languages.createDiagnosticCollection("bruno");
    context.subscriptions.push(diagnosticCollection);

    const brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
        diagnosticCollection,
        collectionItemProvider
    );

    context.subscriptions.push(
        brunoLangDiagnosticsProvider,
        workspace.onDidOpenTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.uri.fsPath
                )
            ) {
                fetchDiagnostics(e, brunoLangDiagnosticsProvider);
            }
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (
                e.contentChanges.length > 0 &&
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.document.uri.fsPath
                )
            ) {
                fetchDiagnostics(e.document, brunoLangDiagnosticsProvider);
            }
        }),
        workspace.onWillSaveTextDocument((e) => {
            if (
                window.activeTextEditor &&
                window.activeTextEditor.document.uri.toString() ==
                    e.document.uri.toString()
            ) {
                window.activeTextEditor.edit((editBuilder) => {
                    updateDocumentBeforeSaving(e.document, editBuilder);
                });
            }
        })
    );
}

function updateDocumentBeforeSaving(
    document: TextDocument,
    editBuilder: TextEditorEdit
) {
    const { blocks } = parseTestFile(
        new TextDocumentHelper(document.getText())
    );
    const urlField = getUrlFieldFromMethodBlock(blocks);
    const queryParamsBlocks = getValidDictionaryBlocksWithName(
        blocks,
        RequestFileBlockName.QueryParams
    );

    if (urlField && queryParamsBlocks.length == 1) {
        const queryParamsFromUrl = getQueryParamsFromUrl(urlField.value);
        const queryParamsFromQueryParamsBlock =
            getExpectedUrlQueryParamsForQueryParamsBlock(queryParamsBlocks[0]);

        if (
            (!queryParamsFromUrl && queryParamsFromQueryParamsBlock.size > 0) ||
            (queryParamsFromUrl &&
                queryParamsFromUrl.toString() !=
                    queryParamsFromQueryParamsBlock.toString())
        ) {
            const startChar = urlField.value.includes("?")
                ? urlField.valueRange.start.character +
                  urlField.value.indexOf("?")
                : urlField.valueRange.end.character;

            editBuilder.replace(
                new Range(
                    new Position(urlField.valueRange.start.line, startChar),
                    urlField.valueRange.end
                ),
                `${getUrlSubstringForQueryParams(
                    queryParamsFromQueryParamsBlock
                )}`
            );
        }
    }
}

function fetchDiagnostics(
    document: TextDocument,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider
) {
    brunoLangDiagnosticsProvider.provideDiagnostics(
        document.uri,
        document.getText()
    );
}
