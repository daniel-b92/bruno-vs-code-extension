import { TestCollection } from "../testData/testCollection";
import { BrunoTestData, getCollectionForTest } from "../testTreeHelper";
import { showHtmlReport } from "./showHtmlReport";
import { getCollectionRootDir } from "../fileSystem/collectionRootFolderHelper";
import { existsSync } from "fs";
import {
    EventEmitter,
    TestController,
    TestRun,
    TestRunRequest,
    TestItem as vscodeTestItem,
    TestItemCollection as vscodeTestItemCollection,
    workspace,
} from "vscode";
import { dirname, resolve } from "path";
import { runTestStructure } from "./runTestStructure";
import { QueuedTest, TestRunQueue } from "./testRunQueue";

const environmentConfigKey = "brunoTestExtension.testRunEnvironment";

export const startTestRun = async (
    ctrl: TestController,
    request: TestRunRequest,
    registeredCollections: TestCollection[],
    queue: TestRunQueue
) => {
    const discoverTests = (tests: Iterable<vscodeTestItem>) => {
        const result: QueuedTest[] = [];
        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }
            const collection = getCollectionForTest(
                test.uri!,
                registeredCollections
            );
            const data = collection.testData.get(test)!;
            const id = getIdForQueuedRun(data, new Date());

            result.push({
                request,
                test,
                data,
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
                queuedTest: { id, data, test, abortEmitter },
            } = await nextItemToRun;

            run.token.onCancellationRequested(() => {
                abortEmitter.fire();
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);

                queue.removeItemsFromQueue(toRun.splice(0));
            });

            if (
                !(await prepareAndRunTest(
                    { test, data, abortEmitter, id, request },
                    run
                ))
            ) {
                break;
            }
            
            run.end();

            const htmlReportPath = getHtmlReportPath(
                await getCollectionRootDir(data)
            );
            if (existsSync(htmlReportPath)) {
                showHtmlReport(htmlReportPath, data);
            }

            nextItemToRun = queue.getNextTestThatCanStartRunning(toRun);

            queue.removeItemsFromQueue([
                {
                    request,
                    test,
                    data,
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
    { test, data, abortEmitter }: QueuedTest,
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
        getHtmlReportPath(await getCollectionRootDir(data)),
        testEnvironment
    );

    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    await runTestStructure(test, data, run, abortEmitter, testEnvironment);

    if (checkForRequestedCancellation(run)) {
        run.end();
        return false;
    }

    return true;
};

const checkForRequestedCancellation = (run: TestRun) =>
    run.token.isCancellationRequested;

const getIdForQueuedRun = (data: BrunoTestData, creationTime: Date) =>
    `${data.path}@${creationTime.toISOString()}`;

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
