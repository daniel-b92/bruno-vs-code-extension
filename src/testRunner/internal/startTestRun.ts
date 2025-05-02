import { showHtmlReport } from "./showHtmlReport";
import { existsSync } from "fs";
import {
    EventEmitter,
    TestController,
    TestRun,
    TestRunRequest,
    Uri,
    TestItem as vscodeTestItem,
    TestItemCollection as vscodeTestItemCollection,
    window,
    workspace,
} from "vscode";
import { dirname, extname, isAbsolute, resolve } from "path";
import { runTestStructure } from "./runTestStructure";
import { QueuedTest, TestRunQueue } from "./testRunQueue";
import { CollectionItemProvider, getCollectionRootDir } from "../../shared";

const environmentConfigKey = "bruno.testRunEnvironment";

export const startTestRun = async (
    ctrl: TestController,
    request: TestRunRequest,
    collectionItemProvider: CollectionItemProvider,
    queue: TestRunQueue
) => {
    const discoverTests = (tests: Iterable<vscodeTestItem>) => {
        const result: QueuedTest[] = [];
        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }

            const path = (test.uri as Uri).fsPath;
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(path);

            if (!collection) {
                throw new Error(
                    `Did not find registered collection for item with Uri '${JSON.stringify(
                        test.uri,
                        null,
                        2
                    )}'`
                );
            }

            const id = getIdForQueuedRun(path, new Date());

            result.push({
                request,
                test,
                id,
                abortEmitter: new EventEmitter<void>(),
            });
        }
        return result;
    };

    const runTestQueue = async (toRun: QueuedTest[]) => {
        let nextItemToRun = queue.getNextTestThatCanStartRunning(toRun);
        for (const item of toRun) {
            queue.addToQueue(item);
        }

        while (toRun.length > 0) {
            const {
                run,
                queuedTest: { id, test, abortEmitter },
            } = await nextItemToRun;
            const path = (test.uri as Uri).fsPath;
            const htmlReportPath = getHtmlReportPath(
                await getCollectionRootDir(path)
            );

            run.token.onCancellationRequested(() => {
                abortEmitter.fire();
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);

                queue.removeItemsFromQueue(toRun.splice(0));
            });

            if (
                !(await prepareAndRunTest(
                    { test, abortEmitter, id, request },
                    run,
                    htmlReportPath
                ))
            ) {
                break;
            }

            run.end();

            if (existsSync(htmlReportPath)) {
                showHtmlReport(htmlReportPath, path);
            }

            nextItemToRun = queue.getNextTestThatCanStartRunning(toRun);

            queue.removeItemsFromQueue([
                {
                    request,
                    test,
                    id,
                    abortEmitter,
                },
            ]);
            toRun.splice(
                toRun.findIndex(({ id: idForMatching }) => idForMatching == id),
                1
            );
        }
    };

    const toRun = discoverTests(request.include ?? gatherTestItems(ctrl.items));
    await runTestQueue(toRun);
};

const prepareAndRunTest = async (
    { test, abortEmitter }: QueuedTest,
    run: TestRun,
    htmlReportPath: string
) => {
    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    run.appendOutput(`Running ${test.label}\r\n`);

    run.started(test);

    const testEnvironment = workspace
        .getConfiguration()
        .get(environmentConfigKey) as string | undefined;

    printInfosOnTestRunStart(run, htmlReportPath, testEnvironment);

    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    await runTestStructure(
        test,
        run,
        abortEmitter,
        test.canResolveChildren,
        htmlReportPath,
        testEnvironment
    );

    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    return true;
};

const checkForRequestedCancellation = (run: TestRun) =>
    run.token.isCancellationRequested;

const getIdForQueuedRun = (itemPath: string, creationTime: Date) =>
    `${itemPath}@${creationTime.toISOString()}`;

const printInfosOnTestRunStart = (
    run: TestRun,
    htmlReportPath: string,
    testEnvironment?: string
) => {
    if (!testEnvironment) {
        run.appendOutput(`Not using any environment for the test run.\r\n`);
        run.appendOutput(
            `You can configure an environment to use via the setting '${environmentConfigKey}'.\r\n`
        );
    } else {
        run.appendOutput(
            `Using the test environment '${testEnvironment}'.\r\n`
        );
    }
    run.appendOutput(
        `Saving the HTML test report to file '${htmlReportPath}'.\r\n`
    );
};

const getHtmlReportPath = (collectionRootDir: string) => {
    const reportPathConfigKey = "bruno.htmlReportPath";
    const defaultFileName = "results.html";
    const fallbackAbsolutePath = resolve(
        collectionRootDir,
        `../${defaultFileName}`
    );

    const configValue = workspace
        .getConfiguration()
        .get<string>(reportPathConfigKey);

    if (!configValue || extname(configValue) != ".html") {
        showWarningForInvalidOrMissingHtmlReportPathConfig(
            configValue,
            fallbackAbsolutePath
        );
        return fallbackAbsolutePath;
    } else if (isAbsolute(configValue) && existsSync(dirname(configValue))) {
        return configValue;
    } else if (
        !isAbsolute(configValue) &&
        existsSync(dirname(resolve(collectionRootDir, configValue)))
    ) {
        return resolve(collectionRootDir, configValue);
    } else {
        showWarningForInvalidOrMissingHtmlReportPathConfig(
            configValue,
            fallbackAbsolutePath
        );
        return fallbackAbsolutePath;
    }
};

function showWarningForInvalidOrMissingHtmlReportPathConfig(
    configValue: string | undefined,
    fallbackPathThatWillBeUsed: string
) {
    window.showWarningMessage(
        `Configured HTML report path '${configValue}' is invalid or missing. Will use the fallback path '${fallbackPathThatWillBeUsed}' instead.`
    );
}

function gatherTestItems(collection: vscodeTestItemCollection) {
    const items: vscodeTestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}
