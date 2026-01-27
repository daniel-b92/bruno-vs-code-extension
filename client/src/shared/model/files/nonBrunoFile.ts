import { CollectionItem, NonBrunoSpecificItemType } from "../interfaces";

export class NonBrunoFile implements CollectionItem {
    constructor(private readonly path: string) {}

    public getPath() {
        return this.path;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return NonBrunoSpecificItemType.OtherFileType;
    }
}
