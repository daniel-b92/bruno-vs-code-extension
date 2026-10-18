import {
    Connection,
    Disposable,
    DocumentFormattingRequest,
    DocumentFilter,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";

/**
 * Formatting is registered dynamically instead of statically in the server capabilities.
 * That way, Yaml files only get this formatter assigned if they are part of a Yaml collection.
 * Otherwise, the formatter would compete with other Yaml formatters for all Yaml files in the workspace.
 */
export class FormattingRegistration implements Disposable {
    constructor(private connection: Connection) {}

    /** Needs to be called whenever the set of Yaml collections might have changed. */
    public update(yamlCollectionRootDirectories: string[]) {
        const key = JSON.stringify([...yamlCollectionRootDirectories].sort());

        if (key == this.currentKey) {
            return this.pendingUpdate;
        }
        this.currentKey = key;

        const documentSelector: DocumentFilter[] = [
            { scheme: "file", language: "bru" },
            ...yamlCollectionRootDirectories.map((root): DocumentFilter => ({
                scheme: "file",
                language: "yaml",
                pattern: {
                    baseUri: URI.file(root).toString(),
                    pattern: "**/*.yml",
                },
            })),
        ];

        this.pendingUpdate = this.pendingUpdate
            .then(() => this.registration?.dispose())
            .then(() =>
                this.connection.client.register(
                    DocumentFormattingRequest.type,
                    {
                        documentSelector,
                    },
                ),
            )
            .then((registration) => {
                this.registration = registration;
            })
            .catch((error) => {
                this.registration = undefined;
                this.connection.console.error(
                    `Failed to register the formatting provider: ${error}`,
                );
            });

        return this.pendingUpdate;
    }

    public dispose() {
        this.pendingUpdate = this.pendingUpdate.then(() =>
            this.registration?.dispose(),
        );
    }

    private currentKey: string | undefined = undefined;
    private registration: Disposable | undefined = undefined;
    private pendingUpdate: Promise<void> = Promise.resolve();
}
