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
    workspace,
} from "vscode";
import { dirname, resolve } from "path";
import { runTestStructure } from "./runTestStructure";
import { QueuedTest, TestRunQueue } from "./testRunQueue";
import { CollectionItemProvider, getCollectionRootDir } from "../../shared";

const environmentConfigKey = "brunoTestExtension.testRunEnvironment";

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
                collectionItemProvider.getRegisteredCollectionForItem(path);

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

            run.token.onCancellationRequested(() => {
                abortEmitter.fire();
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);

                queue.removeItemsFromQueue(toRun.splice(0));
            });

            if (
                !(await prepareAndRunTest(
                    { test, abortEmitter, id, request },
                    run
                ))
            ) {
                break;
            }

            run.end();

            const htmlReportPath = getHtmlReportPath(
                await getCollectionRootDir(path)
            );
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
    run: TestRun
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

    printInfosOnTestRunStart(
        run,
        getHtmlReportPath(await getCollectionRootDir((test.uri as Uri).fsPath)),
        testEnvironment
    );

    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    await runTestStructure(
        test,
        run,
        abortEmitter,
        test.canResolveChildren,
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

export const getHtmlReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.html");

function gatherTestItems(collection: vscodeTestItemCollection) {
    const items: vscodeTestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}
