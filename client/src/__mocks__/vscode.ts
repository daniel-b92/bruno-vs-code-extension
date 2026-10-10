const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

class TreeItem {
    label?: string | { label: string };
    collapsibleState?: number;
    tooltip?: unknown;
    description?: unknown;
    contextValue?: string;
    command?: unknown;

    constructor(label: string | { label: string }, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => {} };
    };

    fire(_event: T) {}

    dispose() {}
}

class MarkdownString {
    constructor(public value: string = "") {}
}

const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: "file", path }),
};

const workspace = {
    getConfiguration: () => ({ get: () => undefined }),
    workspaceFolders: undefined,
    textDocuments: [] as { fileName: string; eol: number }[],
};

const EndOfLine = {
    LF: 1,
    CRLF: 2,
};

const window = {
    showInformationMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    showInputBox: (_options?: unknown): Promise<string | undefined> =>
        Promise.resolve(undefined),
    createQuickPick: (): unknown => ({}),
};

const commands = {
    executeCommand: (_command: string, ..._args: unknown[]) =>
        Promise.resolve(undefined),
};

export {
    TreeItemCollapsibleState,
    TreeItem,
    EventEmitter,
    MarkdownString,
    Uri,
    workspace,
    window,
    commands,
    EndOfLine,
};
