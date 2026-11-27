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
    resourceUri?: unknown;
    iconPath?: unknown;

    constructor(label: string | { label: string }, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

class ThemeColor {
    constructor(public readonly id: string) {}
}

class ThemeIcon {
    static readonly File = new ThemeIcon("file");
    static readonly Folder = new ThemeIcon("folder");

    constructor(
        public readonly id: string,
        public readonly color?: ThemeColor,
    ) {}
}

class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter((l) => l !== listener);
            },
        };
    };

    fire(event: T) {
        this.listeners.slice().forEach((listener) => listener(event));
    }

    dispose() {
        this.listeners = [];
    }
}

class TabInputText {
    constructor(public readonly uri: { fsPath: string }) {}
}

class RelativePattern {
    constructor(
        public readonly base: { fsPath: string },
        public readonly pattern: string,
    ) {}
}

class MarkdownString {
    constructor(public value: string = "") {}
}

const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: "file", path }),
    parse: (value: string) => ({ toString: () => value }),
};

class Position {
    constructor(
        public readonly line: number,
        public readonly character: number,
    ) {}
}

class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position,
    ) {}
}

/** `applyEdit` does not apply any edits. Tests that need the edits to take effect have to write the files themselves. The recorded entries can be used to check what would be applied. */
class WorkspaceEdit {
    readonly renames: {
        from: { fsPath: string };
        to: { fsPath: string };
        options?: { overwrite?: boolean };
    }[] = [];
    readonly replacements: {
        uri: { fsPath: string };
        range: Range;
        newText: string;
    }[] = [];

    createFile(_uri: unknown, _options?: unknown) {}

    renameFile(
        from: { fsPath: string },
        to: { fsPath: string },
        options?: { overwrite?: boolean },
    ) {
        this.renames.push({ from, to, options });
    }

    replace(uri: { fsPath: string }, range: Range, newText: string) {
        this.replacements.push({ uri, range, newText });
    }
}

const workspace = {
    getConfiguration: () => ({ get: () => undefined }),
    onDidChangeConfiguration: (_listener: (e: unknown) => void) => ({
        dispose: () => {},
    }),
    workspaceFolders: undefined,
    textDocuments: [] as {
        fileName: string;
        eol: number;
        uri: { fsPath: string };
        isDirty: boolean;
        getText: () => string;
    }[],
    applyEdit: (_edit: unknown, _metadata?: unknown) => Promise.resolve(true),
    save: (_uri: unknown): Promise<unknown> => Promise.resolve(undefined),
    /** Tests that need to trigger events can replace it, e.g. with `jest.spyOn`. */
    createFileSystemWatcher: (_pattern: unknown) => ({
        onDidCreate: (_listener: (uri: { fsPath: string }) => void) => ({
            dispose: () => {},
        }),
        onDidDelete: (_listener: (uri: { fsPath: string }) => void) => ({
            dispose: () => {},
        }),
        onDidChange: (_listener: (uri: { fsPath: string }) => void) => ({
            dispose: () => {},
        }),
        dispose: () => {},
    }),
};

const EndOfLine = {
    LF: 1,
    CRLF: 2,
};

const window = {
    showInformationMessage: (..._args: unknown[]) => Promise.resolve(undefined),
    showErrorMessage: (..._args: unknown[]) => Promise.resolve(undefined),
    showWarningMessage: (..._args: unknown[]) => Promise.resolve(undefined),
    showInputBox: (_options?: unknown): Promise<string | undefined> =>
        Promise.resolve(undefined),
    createQuickPick: (): unknown => ({}),
    createTreeView: (_viewId: string, _options: unknown) => ({
        visible: false,
        selection: [],
        onDidChangeVisibility: (_listener: unknown) => ({ dispose: () => {} }),
    }),
    onDidChangeActiveTextEditor: (_listener: unknown) => ({
        dispose: () => {},
    }),
    onDidChangeTextEditorSelection: (_listener: unknown) => ({
        dispose: () => {},
    }),
    withProgress: <T>(_options: unknown, task: () => Promise<T>) => task(),
    tabGroups: {
        all: [] as { tabs: { input: unknown }[] }[],
        close: (_tabs: unknown): Promise<boolean> => Promise.resolve(true),
    },
};

const commands = {
    registerCommand: (_command: string, _callback: unknown) => ({
        dispose: () => {},
    }),
    executeCommand: (_command: string, ..._args: unknown[]) =>
        Promise.resolve(undefined),
};

const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
};

const extensions = {
    getExtension: (_id: string): unknown => undefined,
    onDidChange: (_listener: () => void) => ({ dispose: () => {} }),
};

const env = {
    openExternal: (_target: unknown) => Promise.resolve(true),
};

export {
    ConfigurationTarget,
    extensions,
    env,
    TreeItemCollapsibleState,
    TreeItem,
    ThemeColor,
    ThemeIcon,
    EventEmitter,
    MarkdownString,
    RelativePattern,
    TabInputText,
    Uri,
    Position,
    Range,
    workspace,
    WorkspaceEdit,
    window,
    commands,
    EndOfLine,
};
