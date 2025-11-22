import { FileChangeType } from "../..";
import { OutputChannelLogger } from "../../logging/outputChannelLogger";
import { NotificationData } from "../externalHelpers/collectionItemProvider";
import { Event, Disposable } from "vscode";

export enum ResultCode {
    Aborted = 1,
    TimedOut = 2,
    WaitingCompleted = 3,
}

export async function waitForFilesFromFolderToBeInSync(
    filesToCheckWithinFolder: readonly { path: string; sequence?: number }[],
    parentFolder: string,
    callbacks: {
        getSubscriptionForCacheUpdates: () => Event<NotificationData[]>;
        shouldAbort: () => boolean;
    },
    timeoutInMillis: number,
    logger?: OutputChannelLogger,
): Promise<ResultCode> {
    const { getSubscriptionForCacheUpdates, shouldAbort } = callbacks;
    const remainingFilesToCheck = [...filesToCheckWithinFolder];
    let timeout: NodeJS.Timeout | undefined = undefined;
    let disposable: Disposable | undefined = undefined;

    if (remainingFilesToCheck.length == 0) {
        logger?.debug(
            `Cached items from folder '${parentFolder}' already up to date on first check.`,
        );

        return Promise.resolve(ResultCode.WaitingCompleted);
    }

    const toAwait = new Promise<ResultCode>((resolve) => {
        disposable = getSubscriptionForCacheUpdates()((updates) => {
            if (shouldAbort()) {
                logger?.debug(
                    `Aborting waiting for files from folder '${parentFolder}' to be registered in cache.`,
                );
                return resolve(ResultCode.Aborted);
            }

            for (const {
                updateType,
                data: { item },
            } of updates) {
                if (
                    [FileChangeType.Created, FileChangeType.Modified].includes(
                        updateType,
                    ) &&
                    remainingFilesToCheck.some(
                        ({ path }) => path == item.getPath(),
                    )
                ) {
                    const index = remainingFilesToCheck.findIndex(
                        ({ path }) => path == item.getPath(),
                    );

                    const expectedSequence =
                        remainingFilesToCheck[index].sequence;

                    if (expectedSequence === item.getSequence()) {
                        remainingFilesToCheck.splice(index, 1);

                        if (remainingFilesToCheck.length == 0) {
                            break;
                        }
                    }
                }
            }

            if (remainingFilesToCheck.length == 0) {
                return resolve(ResultCode.WaitingCompleted);
            }
        });

        timeout = setTimeout(() => {
            logger?.debug(
                `Timeout of ${timeoutInMillis} ms reached while waiting for items '${JSON.stringify(
                    filesToCheckWithinFolder.map(({ path }) => path),
                    null,
                    2,
                )}' to be registered in cache.`,
            );
            return resolve(ResultCode.TimedOut);
        }, timeoutInMillis);
    });

    const result = await toAwait;

    if (disposable) {
        (disposable as Disposable).dispose();
    }

    clearTimeout(timeout);

    return result;
}
