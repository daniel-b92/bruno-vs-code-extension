import {
    CollectionItem,
    NonBrunoSpecificItemType,
} from "../interfaces_generic";

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
