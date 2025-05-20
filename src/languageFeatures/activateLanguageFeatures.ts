import {
    commands,
    CompletionContext,
    CompletionList,
    ExtensionContext,
    languages,
    Position,
    TextDocument,
    Uri,
    window,
    workspace,
} from "vscode";
import { provideBrunoLangCompletionItems } from "./internal/completionItems/provideBrunoLangCompletionItems";
import {
    Block,
    Collection,
    CollectionItemProvider,
    mapRange,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../shared";
import { isBrunoRequestFile } from "./internal/diagnostics/shared/util/isBrunoRequestFile";
import { BrunoLangDiagnosticsProvider } from "./internal/diagnostics/brunoLangDiagnosticsProvider";
import { updateUrlToMatchQueryParams } from "./internal/autoUpdates/updateUrlToMatchQueryParams";
import { updatePathParamsKeysToMatchUrl } from "./internal/autoUpdates/updatePathParamsKeysToMatchUrl";
import { isBrunoEnvironmentFile } from "./internal/diagnostics/shared/util/isBrunoEnvironmentFile";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { basename, extname, resolve } from "path";
import { getRequestFileDocumentSelector } from "./internal/shared/getRequestFileDocumentSelector";
import { getExtraLibraries } from "./brunoIndex";

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

    languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            provideCompletionItems(
                document,
                position,
                _cancellationToken,
                context
            ) {
                return getCompletionItemsForBruFile(
                    (
                        collectionItemProvider.getAncestorCollectionForPath(
                            document.fileName
                        ) as Collection
                    ).getRootDirectory(),
                    document,
                    position,
                    context
                );
            },
        },
        ".",
        "(",
        " ",
        "/"
    );

    context.subscriptions.push(
        brunoLangDiagnosticsProvider,
        workspace.onDidOpenTextDocument((doc) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    doc.uri.fsPath
                )
            ) {
                const collectionRootDir = (
                    collectionItemProvider.getAncestorCollectionForPath(
                        doc.fileName
                    ) as Collection
                ).getRootDirectory();

                createTemporaryJsFile(
                    collectionRootDir,
                    doc.fileName,
                    doc.getText()
                );

                writeFileSync(
                    resolve(collectionRootDir, "index.d.ts"),
                    getExtraLibraries(["bru", "req", "res"])
                );
            }

            fetchDiagnostics(
                doc,
                brunoLangDiagnosticsProvider,
                collectionItemProvider.getRegisteredCollections().slice()
            );
        }),
        workspace.onDidChangeTextDocument((e) => {
            if (e.contentChanges.length > 0) {
                if (
                    isBrunoRequestFile(
                        collectionItemProvider
                            .getRegisteredCollections()
                            .slice(),
                        e.document.uri.fsPath
                    )
                ) {
                    createTemporaryJsFile(
                        (
                            collectionItemProvider.getAncestorCollectionForPath(
                                e.document.fileName
                            ) as Collection
                        ).getRootDirectory(),
                        e.document.fileName,
                        e.document.getText()
                    );
                }

                fetchDiagnostics(
                    e.document,
                    brunoLangDiagnosticsProvider,
                    collectionItemProvider.getRegisteredCollections().slice()
                );
            }
        }),
        workspace.onWillSaveTextDocument((e) => {
            if (
                isBrunoRequestFile(
                    collectionItemProvider.getRegisteredCollections().slice(),
                    e.document.uri.fsPath
                ) &&
                window.activeTextEditor &&
                window.activeTextEditor.document.uri.toString() ==
                    e.document.uri.toString()
            ) {
                const collectionRootDir = (
                    collectionItemProvider.getAncestorCollectionForPath(
                        e.document.fileName
                    ) as Collection
                ).getRootDirectory();

                const virtualJsFile = getVirtualJsFileName(
                    collectionRootDir,
                    e.document.fileName
                );

                if (existsSync(virtualJsFile)) {
                    unlinkSync(virtualJsFile);
                }
                if (existsSync(resolve(collectionRootDir, "index.d.ts"))) {
                    unlinkSync(resolve(collectionRootDir, "index.d.ts"));
                }

                const { blocks: parsedBlocks } = parseBruFile(
                    new TextDocumentHelper(e.document.getText())
                );

                window.activeTextEditor.edit((editBuilder) => {
                    updateUrlToMatchQueryParams(editBuilder, parsedBlocks);
                    updatePathParamsKeysToMatchUrl(
                        e.document,
                        editBuilder,
                        parsedBlocks
                    );
                });
            }
        })
    );
}

function fetchDiagnostics(
    document: TextDocument,
    brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider,
    registeredCollections: Collection[]
) {
    if (isBrunoRequestFile(registeredCollections, document.uri.fsPath)) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForRequestFile(
            document.uri,
            document.getText()
        );
    } else if (
        isBrunoEnvironmentFile(registeredCollections, document.uri.fsPath)
    ) {
        brunoLangDiagnosticsProvider.provideDiagnosticsForEnvironmentFile(
            document.uri,
            document.getText()
        );
    }
}

async function getCompletionItemsForBruFile(
    collectionRootDirectory: string,
    document: TextDocument,
    positionInBruFile: Position,
    context: CompletionContext
) {
    const block = parseBruFile(
        new TextDocumentHelper(document.getText())
    ).blocks.find(({ name }) => name == RequestFileBlockName.Tests) as Block;

    if (mapRange(block.contentRange).contains(positionInBruFile)) {
        const temporaryJsFile = getVirtualJsFileName(
            collectionRootDirectory,
            document.fileName
        );

        const result = await commands.executeCommand<CompletionList>(
            "vscode.executeCompletionItemProvider",
            Uri.file(temporaryJsFile),
            positionInBruFile.translate(-block.contentRange.start.line),
            context.triggerCharacter
        );

        return result.items.map(({ label }) => ({ label }));
    } else {
        return undefined;
    }
}

function createTemporaryJsFile(
    collectionRootDirectory: string,
    bruFileName: string,
    bruFileContent: string
) {
    const block = parseBruFile(
        new TextDocumentHelper(bruFileContent)
    ).blocks.find(({ name }) => name == RequestFileBlockName.Tests) as Block;

    writeFileSync(
        getVirtualJsFileName(collectionRootDirectory, bruFileName),
        block.content as string
    );
}

function getVirtualJsFileName(
    collectionRootDirectory: string,
    bruFileName: string
) {
    return resolve(
        collectionRootDirectory,
        basename(bruFileName).replace(extname(bruFileName), ".js")
    );
}
