export enum FileChangeType {
    Created = "Created",
    Modified = "Modified",
    Deleted = "Deleted",
}

export interface FileChangedEvent {
    path: string;
    changeType: FileChangeType;
}

export interface MultiFileOperationWithStatus {
    running: boolean;
    parentFolder: string;
}
