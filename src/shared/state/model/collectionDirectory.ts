import { CollectionItem } from "./collectionItemInterface";

export class CollectionDirectory implements CollectionItem {
    constructor(private path: string) {}

    public getPath() {
        return this.path;
    }
}
