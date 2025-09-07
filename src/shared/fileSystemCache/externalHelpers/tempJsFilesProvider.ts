import { basename } from "path";
import {
    CollectionWatcher,
    FileChangeType,
    normalizeDirectoryPath,
    OutputChannelLogger,
    getTemporaryJsFileBasenameWithoutExtension,
    getTemporaryJsFileBasename,
} from "../..";
import { glob } from "glob";

export class TempJsFilesProvider {
    constructor(
        collectionWatcher: CollectionWatcher,
        private logger?: OutputChannelLogger,
    ) {
        collectionWatcher.subscribeToUpdates()(
            ({ uri: { fsPath }, changeType: fileChangeType }) => {
                if (
                    fileChangeType == FileChangeType.Deleted &&
                    this.registeredTempJsFiles
                ) {
                    const index = this.registeredTempJsFiles.findIndex(
                        (registered) =>
                            fsPath == registered ||
                            registered.startsWith(
                                normalizeDirectoryPath(fsPath),
                            ),
                    );

                    if (index >= 0) {
                        this.registeredTempJsFiles.splice(index, 1);
                    }
                } else if (
                    fileChangeType == FileChangeType.Created &&
                    basename(fsPath) == getTemporaryJsFileBasename() &&
                    (!this.registeredTempJsFiles ||
                        !this.registeredTempJsFiles.includes(fsPath))
                ) {
                    if (!this.registeredTempJsFiles) {
                        this.registeredTempJsFiles = [];
                    }

                    this.registeredTempJsFiles.push(fsPath);
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
                            `${
                                dir == normalizeDirectoryPath(dir)
                                    ? dir.substring(0, dir.length - 1)
                                    : dir
                            }/**/${getTemporaryJsFileBasenameWithoutExtension()}.js`,
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
            `${this.commonPreMessageForLogging} Cache refresh duration: ${
                endTime - startTime
            } ms`,
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
