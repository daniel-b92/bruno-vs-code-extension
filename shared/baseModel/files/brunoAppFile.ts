import { BrunoFileType, CollectionItem } from "../interfaces";

export class BrunoAppFile implements CollectionItem {
    constructor(private readonly path: string) {}

    public getPath() {
        return this.path;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.AppFile;
    }
}
