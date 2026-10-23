import {
    CollectionItemWithSequence,
    CollectionItemWithTags,
    NonBrunoSpecificItemType,
} from "./interfaces";

export class CollectionDirectory
    implements CollectionItemWithSequence, CollectionItemWithTags
{
    constructor(
        private path: string,
        private settingsFilePath?: string,
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
        return false;
    }

    public getItemType() {
        return NonBrunoSpecificItemType.Directory;
    }

    public getSettingsFilePath() {
        return this.settingsFilePath;
    }
}
