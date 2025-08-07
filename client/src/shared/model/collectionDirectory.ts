import { CollectionItem } from "./interfaces";

export class CollectionDirectory implements CollectionItem {
    constructor(private path: string, private sequence?: number) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }
}
