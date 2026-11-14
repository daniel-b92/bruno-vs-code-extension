import {
    CompletionRegistrationOptions,
    CompletionRequest,
    Connection,
} from "vscode-languageserver/node";

const COMMON_TRIGGER_CHARACTERS = [":", " ", "{", ".", "/", '"', "'", "`"];

/**
 * Completions are registered dynamically instead of statically in the server capabilities, because the trigger characters differ between the file types:
 * Only Bru and Yaml files need `$` as trigger character (for Bruno's dynamic variables, `{{$...`).
 * In JS files, it would make VS Code ask this server whenever `$` is typed (e.g. `$scope`, `${`) and drop the suggestions of the TypeScript server for that keystroke.
 *
 * The document selectors must not overlap. Otherwise, the server would be asked twice and the items would be shown twice.
 * They need to be kept in sync with the `documentSelector` of the client.
 */
export const COMPLETION_REGISTRATIONS: CompletionRegistrationOptions[] = [
    {
        documentSelector: [
            { scheme: "file", language: "bru" },
            { scheme: "file", language: "yaml", pattern: "**/*.yml" },
        ],
        triggerCharacters: [...COMMON_TRIGGER_CHARACTERS, "$"],
        completionItem: { labelDetailsSupport: true },
    },
    {
        documentSelector: [{ scheme: "file", language: "javascript" }],
        triggerCharacters: COMMON_TRIGGER_CHARACTERS,
        completionItem: { labelDetailsSupport: true },
    },
];

/**
 * Needs to be called once, as early as possible (it doesn't depend on the cache).
 * Intentionally doesn't return the registrations for unregistering them, since the client drops them on its own when it stops (see `FormattingRegistration`).
 */
export function registerCompletionProviders(connection: Connection) {
    return Promise.all(
        COMPLETION_REGISTRATIONS.map((options) =>
            connection.client
                .register(CompletionRequest.type, options)
                .catch((error) => {
                    connection.console.error(
                        `Failed to register the completion provider: ${error}`,
                    );
                }),
        ),
    );
}
