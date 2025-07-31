import { CollectionItem, FileType } from "./interfaces";

export class CollectionFile implements CollectionItem {
    constructor(
        private path: string,
        private fileType: FileType,
        private sequence?: number,
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public getFileType() {
        return this.fileType;
    }
}
