export class CollectionFile {
    constructor(private path: string, private sequence?: number) {}

    public getSequence() {
        return this.sequence;
    }

    public getPath() {
        return this.path;
    }
}
