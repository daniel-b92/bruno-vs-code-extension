import { Uri } from "vscode";

export enum FileChangeType {
    Created = "Created",
    Modified = "Modified",
    Deleted = "Deleted",
}

export interface FileChangedEvent {
    uri: Uri;
    changeType: FileChangeType;
}

export enum RequestFileSection {
    Meta = "meta",
}
