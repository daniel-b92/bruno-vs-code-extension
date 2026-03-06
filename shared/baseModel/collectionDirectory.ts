import { BrunoVariableReference } from "..";
import {
    CollectionItemWithBruVariables,
    CollectionItemWithSequence,
    NonBrunoSpecificItemType,
} from "./interfaces";

export class CollectionDirectory
    implements CollectionItemWithSequence, CollectionItemWithBruVariables
{
    constructor(
        private path: string,
        private settingsFilePath?: string,
        private sequence?: number,
        private variableReferences?: BrunoVariableReference[],
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

    public getVariableReferences() {
        return this.variableReferences ?? [];
    }

    public getSettingsFilePath() {
        return this.settingsFilePath;
    }
}
