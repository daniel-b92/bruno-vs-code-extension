import { CollectionItem, FileVariables } from "./interfaces";

export class CollectionFile implements CollectionItem {
    constructor(
        private path: string,
        private sequence?: number,
        private variables?: FileVariables,
    ) {}

    public getPath() {
        return this.path;
    }

    public getSequence() {
        return this.sequence;
    }

    public getReferencedEnvironmentVariables() {
        return this.variables
            ? {
                  used: this.variables.usedEnvironmentVars,
                  set: this.variables.setEnvironmentVars,
              }
            : undefined;
    }
}
