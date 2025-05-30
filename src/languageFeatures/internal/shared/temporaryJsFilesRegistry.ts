export class TemporaryJsFilesRegistry {
    constructor() {}

    private jsFiles: string[] = [];

    public registerJsFile(filePath: string) {
        if (!this.jsFiles.includes(filePath)) {
            this.jsFiles.push(filePath);
        }
    }

    public unregisterJsFile(filePath: string) {
        const index = this.jsFiles.indexOf(filePath);

        if (index >= 0) {
            this.jsFiles.splice(index, 1);
        } else {
            console.warn(
                `Temporary js file for unregistering '${filePath}' is not registered.`
            );
        }
    }

    public getRegisteredJsFiles() {
        return this.jsFiles.slice();
    }

    public dispose() {
        this.jsFiles.splice(0, this.jsFiles.length);
    }
}
