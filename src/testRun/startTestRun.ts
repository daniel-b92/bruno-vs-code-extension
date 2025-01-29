import { TestCollection } from "../model/testCollection";
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
import { QueuedTestRun, TestRunQueue } from "../model/testRunQueue";

const environmentConfigKey = "brunoTestExtension.testRunEnvironment";

export const startTestRun = async (
    ctrl: TestController,
    request: TestRunRequest,
    registeredCollections: TestCollection[],
    queue: TestRunQueue,
    canStartRunningEmitter: EventEmitter<QueuedTestRun>
) => {
    const run = ctrl.createTestRun(request);
    const creationTime = new Date();

    const discoverTests = (tests: Iterable<vscodeTestItem>) => {
        const result: QueuedTestRun[] = [];
        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }
            const collection = getCollectionForTest(
                test.uri!,
                registeredCollections
            );
            const data = collection.testData.get(test)!;
            const id = getIdForQueuedRun(data, creationTime);
            run.enqueued(test);

            result.push({ testRun: run, test, data, id });
        }
        return result;
    };

    const runTestQueue = async (toRun: QueuedTestRun[]) => {
        let nextItemToRun = getNextTestThatCanStartRunning(toRun);
        for (const item of toRun) {
            queue.addToQueue(item);
        }

        while (toRun.length > 0) {
            const { test, data, id } = await nextItemToRun;

            run.appendOutput(`Running ${test.label}\r\n`);

            if (run.token.isCancellationRequested) {
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);
                queue.removeItemFromQueue({ testRun: run, test, data, id });
            } else {
                run.started(test);
                const testEnvironment = workspace
                    .getConfiguration()
                    .get(environmentConfigKey) as string | undefined;
                const htmlReportPath = getHtmlReportPath(
                    await getCollectionRootDir(data)
                );
                printInfosOnTestRunStart(run, htmlReportPath, testEnvironment);

                await runTestStructure(test, data, run, testEnvironment);
                if (existsSync(htmlReportPath)) {
                    showHtmlReport(htmlReportPath, data);
                }
            }

            nextItemToRun = getNextTestThatCanStartRunning(toRun);

            run.appendOutput(`Completed ${test.label}\r\n`);
            queue.removeItemFromQueue({ testRun: run, test, data, id });
            toRun.splice(
                toRun.findIndex(({ id: idForMatching }) => idForMatching == id),
                1
            );
        }
        run.end();
    };

    const getNextTestThatCanStartRunning = (queuedItems: QueuedTestRun[]) =>
        new Promise<QueuedTestRun>((resolve) => {
            canStartRunningEmitter.event((item) => {
                for (const queuedItem of queuedItems) {
                    if (item.id == queuedItem.id) {
                        resolve(item);
                    }
                }
            });
        });

    const toRun = discoverTests(request.include ?? gatherTestItems(ctrl.items));
    await runTestQueue(toRun);
};

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
