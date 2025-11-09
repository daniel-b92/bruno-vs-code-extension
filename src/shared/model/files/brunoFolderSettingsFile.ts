import { BrunoFileType } from "../..";
import { CollectionItem } from "../interfaces";

export class BrunoFolderSettingsFile implements CollectionItem {
    constructor(private path: string) {}

    public getPath() {
        return this.path;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.FolderSettingsFile;
    }
}
