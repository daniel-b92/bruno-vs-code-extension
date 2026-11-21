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
    readonly renames: { from: { fsPath: string }; to: { fsPath: string } }[] =
        [];
    readonly replacements: {
        uri: { fsPath: string };
        range: Range;
        newText: string;
    }[] = [];

    createFile(_uri: unknown, _options?: unknown) {}

    renameFile(from: { fsPath: string }, to: { fsPath: string }) {
        this.renames.push({ from, to });
    }

    replace(uri: { fsPath: string }, range: Range, newText: string) {
        this.replacements.push({ uri, range, newText });
    }
}

const workspace = {
    getConfiguration: () => ({ get: () => undefined }),
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
};

const EndOfLine = {
    LF: 1,
    CRLF: 2,
};

const window = {
    showInformationMessage: (..._args: unknown[]) => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    showWarningMessage: (..._args: unknown[]) => Promise.resolve(undefined),
    showInputBox: (_options?: unknown): Promise<string | undefined> =>
        Promise.resolve(undefined),
    createQuickPick: (): unknown => ({}),
};

const commands = {
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
    Uri,
    Position,
    Range,
    workspace,
    WorkspaceEdit,
    window,
    commands,
    EndOfLine,
};
