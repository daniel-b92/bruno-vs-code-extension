import { BrunoFileType, CollectionItemWithSequence } from "../..";

export class BrunoRequestFile implements CollectionItemWithSequence {
    constructor(
        private path: string,
        private sequence?: number,
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public isFile() {
        return false;
    }

    public getItemType() {
        return BrunoFileType.RequestFile;
    }
}
