import { OutputChannelLogger } from "../../../../../shared";
import { writeFile } from "fs";
import { promisify } from "util";
import { CancellationToken, Disposable } from "vscode";

export async function createTemporaryJsFile(
    filePath: string,
    tempJsFileContent: string,
    token?: CancellationToken,
    logger?: OutputChannelLogger,
) {
    let maxRemainingAttempts = 2;
    let wasSuccessful = false;
    let shouldRetry = true;

    if (token && token.isCancellationRequested) {
        return false;
    }

    while (!wasSuccessful && shouldRetry && maxRemainingAttempts > 0) {
        const { wasAborted, shouldRetry: shouldRetryAfterCurrentAttempt } =
            await startAttemptAtCreation(filePath, tempJsFileContent, token);

        maxRemainingAttempts--;

        wasSuccessful = !wasAborted;
        shouldRetry = shouldRetryAfterCurrentAttempt;

        if (!wasSuccessful && shouldRetry) {
            logger?.warn(
                `Did not manage to create temporary js file in last attempt. Remaining attempts: ${maxRemainingAttempts}`,
            );
        } else if (!wasSuccessful && !shouldRetry) {
            logger?.debug(`Creation of temp JS file was aborted`);
        }
    }

    return wasSuccessful;
}

interface CreationAttemptResult {
    wasAborted: boolean;
    shouldRetry: boolean;
}

async function startAttemptAtCreation(
    fileName: string,
    content: string,
    token?: CancellationToken,
): Promise<CreationAttemptResult> {
    let result = undefined as CreationAttemptResult | undefined;

    const toDispose: Disposable[] = [];

    const abortController = new AbortController();

    if (token && token.isCancellationRequested) {
        return { wasAborted: true, shouldRetry: false };
    }

    const timeoutInMs = 5_000;

    const timeout = setTimeout(() => {
        abortController.abort();
        result = { wasAborted: true, shouldRetry: true };
    }, timeoutInMs);

    if (token) {
        toDispose.push(
            token.onCancellationRequested(() => {
                abortController.abort();
                result = { wasAborted: true, shouldRetry: false };
            }),
        );
    }

    if (!result || !result.wasAborted) {
        await promisify(writeFile)(fileName, content, {
            signal: abortController.signal,
        });

        result = { wasAborted: false, shouldRetry: false };
    }

    clearTimeout(timeout);

    toDispose.forEach((disposable) => {
        disposable.dispose();
    });

    return result as CreationAttemptResult;
}
