import {
    createConnection,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    TextDocumentPositionParams,
    InitializeResult,
    TextDocuments,
    CancellationToken,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getBrunoLangCompletionItems } from "./completionItems/getBrunoLangCompletionItems";
import { ConsoleLogger } from "./shared/logging/consoleLogger";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

const logger = new ConsoleLogger(connection.console);

let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});

connection.onDidChangeWatchedFiles((_change) => {
    // Monitored files have change in VSCode
    connection.console.log("We received a file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (
        { position, textDocument: { uri } }: TextDocumentPositionParams,
        token: CancellationToken,
    ): CompletionItem[] => {
        const document = documents.get(uri);

        if (!document) {
            return [];
        }

        // ToDo: Find a better way for logging (if possible also use the same output channel as the client)
        connection.console.info("Fetching completion items");

        return getBrunoLangCompletionItems(
            { document, position, token },
            logger,
        );
    },
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
        item.detail = "TypeScript details";
        item.documentation = "TypeScript documentation";
    } else if (item.data === 2) {
        item.detail = "JavaScript details";
        item.documentation = "JavaScript documentation";
    }
    return item;
});

// Listen on the connection
connection.listen();
