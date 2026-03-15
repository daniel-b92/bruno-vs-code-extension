import { basename } from "path";
import {
    normalizePath,
    CollectionWatcher,
    FileChangeType,
    Logger,
    getTemporaryJsFileBasenameWithoutExtension,
    getTemporaryJsFileBasename,
    convertToGlobPattern,
} from "../..";
import { glob } from "glob";

export class TempJsFilesProvider {
    constructor(
        collectionWatcher: CollectionWatcher,
        private logger?: Logger,
    ) {
        collectionWatcher.subscribeToUpdates(
            ({ path, changeType: fileChangeType }) => {
                if (
                    fileChangeType == FileChangeType.Deleted &&
                    this.registeredTempJsFiles
                ) {
                    const index = this.registeredTempJsFiles.findIndex(
                        (registered) =>
                            path == registered ||
                            registered.startsWith(normalizePath(path)),
                    );

                    if (index >= 0) {
                        this.registeredTempJsFiles.splice(index, 1);
                    }
                } else if (
                    fileChangeType == FileChangeType.Created &&
                    basename(path) == getTemporaryJsFileBasename() &&
                    (!this.registeredTempJsFiles ||
                        !this.registeredTempJsFiles.includes(path))
                ) {
                    if (!this.registeredTempJsFiles) {
                        this.registeredTempJsFiles = [];
                    }

                    this.registeredTempJsFiles.push(path);
                }
            },
        );
    }
    private registeredTempJsFiles: string[] | undefined = undefined;
    private readonly commonPreMessageForLogging = "[TempJsFilesProvider]";

    public getRegisteredFiles() {
        return this.registeredTempJsFiles
            ? this.registeredTempJsFiles.slice()
            : [];
    }

    public async refreshCache(parentDirectoriesToSearchIn: string[]) {
        const startTime = performance.now();

        if (
            this.registeredTempJsFiles &&
            this.registeredTempJsFiles.at.length > 0
        ) {
            this.registeredTempJsFiles.splice(0);
        }

        const found = (
            await Promise.all(
                parentDirectoriesToSearchIn.map(
                    async (dir) =>
                        await glob(
                            `${convertToGlobPattern(
                                dir,
                            )}/**/${getTemporaryJsFileBasenameWithoutExtension()}.js`,
                            { absolute: true },
                        ),
                ),
            )
        ).flat();

        if (!this.registeredTempJsFiles) {
            this.registeredTempJsFiles = [];
        }

        this.registeredTempJsFiles.push(...found);

        const endTime = performance.now();

        // ToDo: Reduce log level(?)
        this.logger?.info(
            `${this.commonPreMessageForLogging} Cache refresh duration: ${Math.round(
                endTime - startTime,
            )} ms`,
        );

        // ToDo: Reduce log level(?)
        this.logger?.info(
            `${this.commonPreMessageForLogging} Found ${found.length} temp JS files in total.`,
        );
    }

    public dispose() {
        if (this.registeredTempJsFiles) {
            this.registeredTempJsFiles.splice(0);
        }
    }
}
