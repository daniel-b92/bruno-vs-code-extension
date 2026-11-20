import { BrunoFileType, CollectionItemWithSequence } from "../interfaces";

export class BrunoAppFile implements CollectionItemWithSequence {
    constructor(
        private readonly path: string,
        private readonly sequence?: number,
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.AppFile;
    }
}
