import {
    CollectionItemWithSequence,
    NonBrunoSpecificItemType,
} from "./interfaces";

export class CollectionDirectory implements CollectionItemWithSequence {
    constructor(
        private path: string,
        private settingsFilePath?: string,
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
        return NonBrunoSpecificItemType.Directory;
    }

    public getSettingsFilePath() {
        return this.settingsFilePath;
    }
}
