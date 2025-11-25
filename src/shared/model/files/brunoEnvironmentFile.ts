import { Range } from "../../fileSystem/util/range";
import { BrunoFileType, CollectionItem } from "../interfaces";

export class BrunoEnvironmentFile implements CollectionItem {
    constructor(
        private readonly path: string,
        private variables: { key: string; range: Range }[],
    ) {}

    public getPath() {
        return this.path;
    }

    public getVariables() {
        return this.variables?.slice();
    }

    public isFile() {
        return true;
    }

    public getItemType() {
        return BrunoFileType.EnvironmentFile;
    }
}
