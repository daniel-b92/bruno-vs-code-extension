export enum FileChangeType {
    Created = "Created",
    Modified = "Modified",
    Deleted = "Deleted",
}

export interface FileChangedEvent {
    path: string;
    changeType: FileChangeType;
}
