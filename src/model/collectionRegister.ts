import { TestCollection } from "./testCollection";

export class CollectionRegister {
    constructor(private collections: TestCollection[]) {}

    public getCurrentCollections = () => this.collections;

    public registerCollection = (collection: TestCollection) =>
        this.collections.push(collection);

    public unregisterCollection = (collection: TestCollection) =>
        this.collections.splice(this.collections.indexOf(collection), 1);
}
