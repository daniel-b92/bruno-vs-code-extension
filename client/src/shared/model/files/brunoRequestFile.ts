import { BrunoFileType, CollectionItemWithSequence } from "../..";

export class BrunoRequestFile implements CollectionItemWithSequence {
    constructor(
        private path: string,
        private sequence?: number,
        private tags?: string[],
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public getTags() {
        return this.tags;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.RequestFile;
    }
}
