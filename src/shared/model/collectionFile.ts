import { CollectionItem } from "./interfaces";

export class CollectionFile implements CollectionItem {
    constructor(private path: string, private sequence?: number) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }
}
