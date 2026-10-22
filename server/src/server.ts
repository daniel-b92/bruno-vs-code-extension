import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeResult,
    CancellationToken,
    CodeActionKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getHandlerForFormatting } from "./bruFiles/formatting/getHandlerForFormatting";
import { getHandlerForYamlFormatting } from "./yamlFiles/formatting/getHandlerForYamlFormatting";
import { FormattingRegistration } from "./shared/formattingRegistration";
import {
    getDefaultLogger,
    HelpersProvider,
    LanguageFeatureBaseRequest,
    LanguageRequestWithTestEnvironmentInfo,
    TypedCollection,
    TypedCollectionItemProvider,
} from "./shared";
import { URI } from "vscode-uri";
import { handleCodeActionRequest as handleCodeActionRequestForBruFile } from "./bruFiles/quickFixes/handleCodeActionRequest";
import {
    FileChangeType,
    getConfiguredEnvironmentNameAsync,
    getItemType,
    NonBrunoSpecificItemType,
    isInFolderForEnvironmentFiles,
    doesFileNameMatchFolderSettingsFileName,
    doesFileNameMatchCollectionSettingsFile,
    isBrunoFileType,
    BrunoFileType,
    Position,
    TextDocumentHelper,
    getFileExtensionForFormat,
    CollectionFormat,
} from "@global_shared";
import { handleCompletionRequest as handleCompletionRequestForBruFile } from "./bruFiles/completions/handleCompletionRequest";
import { handleCompletionRequest as handleCompletionRequestForYamlFile } from "./yamlFiles/completions/handleCompletionRequest";
import { Disposable } from "vscode-languageserver/node";
import { BrunoLangDiagnosticsProvider } from "./bruFiles/diagnostics/brunoLangDiagnosticsProvider";
import { handleHoverRequest as handleHoverRequestForBruFile } from "./bruFiles/hover/handleHoverRequest";
import { handleHoverRequest as handleHoverRequestForYamlFile } from "./yamlFiles/hover/handleHoverRequest";
import { extname } from "path";
import { handleCompletionRequest as handleCompletionRequestForJsFile } from "./jsFiles/completionItems/handleCompletionRequest";
import { handleHoverRequest as handleHoverRequestForJsFile } from "./jsFiles/hover/handleHoverRequest";
import { defaultFeatureToggles, FeatureToggles } from "@global_shared";
import { setFeatureToggles } from "./shared/featureToggles";
import { getYamlFileTypeForEditorContent } from "./yamlFiles/getYamlFileTypeForEditorContent";
import { YamlFormatDiagnosticsProvider } from "./yamlFiles/yamlFormatDiagnosticsProvider";

let helpersProvider: HelpersProvider | undefined = undefined;
let brunoLangDiagnosticsProvider: BrunoLangDiagnosticsProvider;
let yamlDiagnosticsProvider: YamlFormatDiagnosticsProvider;
let formattingRegistration: FormattingRegistration;
const disposables: Disposable[] = [];
enum FileTypeByExtension {
    Bru = ".bru",
    Js = ".js",
    Yml = ".yml",
    Other = "other",
}

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

disposables.push(
    connection.onInitialize(async (params) => {
        setFeatureToggles(
            (
                params.initializationOptions as
                    { featureToggles?: FeatureToggles } | undefined
            )?.featureToggles ?? defaultFeatureToggles,
        );

        const result: InitializeResult = {
            capabilities: {
                workspace: { workspaceFolders: { supported: true } },
                textDocumentSync: {
                    change: TextDocumentSyncKind.Full,
                    openClose: true,
                    save: true,
                },
                // Formatting is registered dynamically (see `FormattingRegistration`).
                completionProvider: {
                    triggerCharacters: [":", " ", "{", ".", "/", '"', "'", "`"],
                    completionItem: { labelDetailsSupport: true },
                },
                diagnosticProvider: {
                    interFileDependencies: true,
                    workspaceDiagnostics: false,
                },
                hoverProvider: true,
                codeActionProvider: {
                    codeActionKinds: [CodeActionKind.QuickFix],
                },
            },
        };
        return result;
    }),
);

disposables.push(
    connection.onInitialized(async () => {
        formattingRegistration = new FormattingRegistration(connection);
        disposables.push(formattingRegistration);
        void formattingRegistration.registerForBruFiles();

        const workspaceFolders = await getWorkspaceFolders();
        helpersProvider = new HelpersProvider(workspaceFolders);
        disposables.push(helpersProvider);

        const itemProvider = helpersProvider.getItemProvider();

        const reporter = await connection.window.createWorkDoneProgress();

        reporter.begin("Refreshing bru-as-code server-side cache...");
        await itemProvider.refreshCache(workspaceFolders);
        reporter.done();

        brunoLangDiagnosticsProvider = new BrunoLangDiagnosticsProvider(
            itemProvider,
        );

        disposables.push(brunoLangDiagnosticsProvider);

        yamlDiagnosticsProvider = new YamlFormatDiagnosticsProvider(
            itemProvider,
        );

        const updateFormattingRegistration = () =>
            formattingRegistration.update(
                itemProvider
                    .getRegisteredCollections()
                    .filter(
                        (collection) =>
                            collection.getFormat() == CollectionFormat.Yaml,
                    )
                    .map((collection) => collection.getRootDirectory()),
            );
        updateFormattingRegistration();

        itemProvider.subscribeToUpdates((changes) => {
            updateFormattingRegistration();

            if (
                changes.some(
                    (change) =>
                        change.updateType == FileChangeType.Modified &&
                        change.changedData?.sequenceChanged,
                )
            ) {
                // Needed for keeping diagnostics for duplicate sequences in sync.
                connection.languages.diagnostics.refresh();
            }
        });

        connection.languages.diagnostics.refresh();
    }),
);

disposables.push(
    connection.onDocumentFormatting(({ textDocument: { uri } }) => {
        const { filePath, type } = getFilePathAndType(uri);
        if (
            type != FileTypeByExtension.Bru &&
            type != FileTypeByExtension.Yml
        ) {
            return undefined;
        }

        const itemProvider = helpersProvider?.getItemProvider();
        const collection = itemProvider?.getAncestorCollectionForPath(filePath);
        const itemType = collection
            ?.getStoredDataForPath(filePath)
            ?.item.getItemType();

        if (!itemType) {
            return undefined;
        }

        const document = documents.get(uri);
        if (!document) {
            return undefined;
        }

        return type == FileTypeByExtension.Bru
            ? getHandlerForFormatting(document, itemType)
            : getHandlerForYamlFormatting(
                  document,
                  getYamlFileTypeForEditorContent(itemType, document.getText()),
              );
    }),
);

disposables.push(
    connection.onCompletion(
        async ({ textDocument: { uri }, position }, token) => {
            const { filePath, type } = getFilePathAndType(uri);

            const baseRequest = mapToBaseLanguageRequest(
                uri,
                { filePathAndType: { filePath, type }, position },
                token,
            );

            const itemProvider = helpersProvider?.getItemProvider();
            const collection =
                itemProvider?.getAncestorCollectionForPath(filePath);

            if (!baseRequest || !itemProvider || !collection) {
                return undefined;
            }

            const params: LanguageRequestWithTestEnvironmentInfo = {
                baseRequest,
                itemProvider,
                collection,
                configuredEnvironmentName:
                    await getConfiguredTestEnvironment(collection),
                logger: getDefaultLogger(),
            };

            switch (type) {
                case FileTypeByExtension.Bru:
                    return handleCompletionRequestForBruFile(params);
                case FileTypeByExtension.Yml:
                    return handleCompletionRequestForYamlFile(params);
                case FileTypeByExtension.Js:
                    return handleCompletionRequestForJsFile(params);
            }
        },
    ),
);

disposables.push(
    connection.languages.diagnostics.on(async ({ textDocument: { uri } }) => {
        const { filePath, type } = getFilePathAndType(uri);

        const defaultResponse = { kind: "full" as const, items: [] };
        const document = documents.get(uri);

        if (
            (type != FileTypeByExtension.Bru &&
                type != FileTypeByExtension.Yml) ||
            !document
        ) {
            return defaultResponse;
        }

        const content = document.getText();

        const items =
            (type == FileTypeByExtension.Bru
                ? await getDiagnosticsForBruFile(filePath, content)
                : await getDiagnosticsForYamlFile(filePath, content)) ?? [];

        return {
            ...defaultResponse,
            items,
        };
    }),
);

connection.onHover(async ({ textDocument: { uri }, position }, token) => {
    const { filePath, type } = getFilePathAndType(uri);

    const baseRequest = mapToBaseLanguageRequest(
        uri,
        { filePathAndType: { filePath, type }, position },
        token,
    );
    const itemProvider = helpersProvider?.getItemProvider();
    const collection = itemProvider?.getAncestorCollectionForPath(filePath);

    if (!baseRequest || !itemProvider || !collection) {
        return undefined;
    }

    const params: LanguageRequestWithTestEnvironmentInfo = {
        baseRequest,
        itemProvider,
        collection,
        configuredEnvironmentName:
            await getConfiguredTestEnvironment(collection),
        logger: getDefaultLogger(),
    };

    switch (type) {
        case FileTypeByExtension.Bru:
            return handleHoverRequestForBruFile(params);
        case FileTypeByExtension.Yml:
            return handleHoverRequestForYamlFile(params);
        case FileTypeByExtension.Js:
            return handleHoverRequestForJsFile(params);
    }
});

connection.onCodeAction(async ({ textDocument: { uri }, context }) => {
    const { filePath, type } = getFilePathAndType(uri);
    const document = documents.get(uri);
    const itemProvider = helpersProvider?.getItemProvider();

    if (type != FileTypeByExtension.Bru || !document || !itemProvider) {
        return [];
    }

    // Only request files can have query params blocks and path params blocks.
    return (await getBrunoFileTypeIfExists(itemProvider, filePath)) ==
        BrunoFileType.RequestFile
        ? handleCodeActionRequestForBruFile({
              uri,
              fileContent: document.getText(),
              diagnostics: context.diagnostics,
          })
        : [];
});

connection.onExit(() => {
    dispose();
});

connection.onShutdown(() => {
    dispose();
});

// Make the text document manager listen on the connection
// for open, change and close text document events
disposables.push(documents.listen(connection));

// Listen on the connection
connection.listen();

async function getWorkspaceFolders() {
    return (
        (await connection.workspace.getWorkspaceFolders())?.map(
            ({ uri }) => URI.parse(uri).fsPath,
        ) ?? []
    );
}

function dispose() {
    disposables.forEach((d) => d.dispose());
    connection.dispose();
}

function mapToBaseLanguageRequest(
    uri: string,
    file: {
        filePathAndType: { filePath: string; type: FileTypeByExtension };
        position: { line: number; character: number };
    },
    token: CancellationToken,
): LanguageFeatureBaseRequest | undefined {
    const {
        filePathAndType: { filePath },
        position: { line, character },
    } = file;
    const document = documents.get(uri);

    return document
        ? {
              filePath,
              documentHelper: new TextDocumentHelper(document.getText()),
              position: new Position(line, character),
              token,
          }
        : undefined;
}

function getConfiguredTestEnvironment(collection: TypedCollection) {
    return getConfiguredEnvironmentNameAsync(
        collection.getRootDirectory(),
        (sectionKey: string) =>
            connection.workspace.getConfiguration(sectionKey),
    );
}

async function getDiagnosticsForBruFile(filePath: string, text: string) {
    const brunoFileType = helpersProvider
        ? await getBrunoFileTypeIfExists(
              helpersProvider.getItemProvider(),
              filePath,
          )
        : undefined;

    if (!brunoLangDiagnosticsProvider || !brunoFileType) {
        return undefined;
    }

    return brunoLangDiagnosticsProvider.getDiagnosticsForBruFile(
        filePath,
        text,
        brunoFileType,
    );
}

async function getDiagnosticsForYamlFile(filePath: string, text: string) {
    const fileType = helpersProvider
        ? await getYamlFileTypeIfExists(
              helpersProvider.getItemProvider(),
              filePath,
          )
        : undefined;

    if (!fileType || !yamlDiagnosticsProvider) {
        // Not a Bruno file within a registered yaml collection (e.g. a CI config).
        return undefined;
    }

    return yamlDiagnosticsProvider.getDiagnosticsForYamlFile(
        filePath,
        text,
        getYamlFileTypeForEditorContent(fileType, text),
    );
}

async function getYamlFileTypeIfExists(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection || collection.getFormat() != CollectionFormat.Yaml) {
        return undefined;
    }

    const itemType = await getItemType(collection, filePath);

    if (itemType && isBrunoFileType(itemType)) {
        return itemType;
    }

    // Includes files that are still being written (e.g. with a missing or invalid `info.type`), so that the user is informed that they are not recognized.
    return itemType == NonBrunoSpecificItemType.OtherFileType &&
        !isInFolderForEnvironmentFiles(filePath) &&
        !doesFileNameMatchFolderSettingsFileName(
            filePath,
            CollectionFormat.Yaml,
        ) &&
        !doesFileNameMatchCollectionSettingsFile(
            filePath,
            CollectionFormat.Yaml,
        )
        ? NonBrunoSpecificItemType.OtherFileType
        : undefined;
}

async function getBrunoFileTypeIfExists(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
) {
    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (!collection) {
        return undefined;
    }

    const itemType = await getItemType(collection, filePath);
    return itemType && isBrunoFileType(itemType) ? itemType : undefined;
}

function getFilePathAndType(uri: string) {
    const filePath = URI.parse(uri).fsPath;

    return {
        filePath,
        type:
            // The file type is already limited by the document selectors defined in the language client.
            extname(filePath) == getFileExtensionForFormat(CollectionFormat.Bru)
                ? FileTypeByExtension.Bru
                : extname(filePath) == ".js"
                  ? FileTypeByExtension.Js
                  : extname(filePath) ==
                      getFileExtensionForFormat(CollectionFormat.Yaml)
                    ? FileTypeByExtension.Yml
                    : FileTypeByExtension.Other,
    };
}
