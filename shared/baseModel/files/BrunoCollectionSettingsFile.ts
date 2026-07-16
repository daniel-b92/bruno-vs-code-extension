import { BrunoFileType, CollectionItem } from "../interfaces";

export class BrunoCollectionSettingsFile implements CollectionItem {
    constructor(private readonly path: string) {}

    public getPath() {
        return this.path;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.CollectionSettingsFile;
    }
}
