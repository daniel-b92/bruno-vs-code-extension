import { CollectionItem } from "./interfaces";

export class CollectionDirectory implements CollectionItem {
    constructor(private path: string) {}

    public getPath() {
        return this.path;
    }
}
