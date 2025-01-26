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

export const startTestRun = (
    ctrl: TestController,
    request: TestRunRequest,
    registeredCollections: TestCollection[],
    queue: TestRunQueue,
    oldestItemChangedEmitter: EventEmitter<QueuedTestRun>
) => {
    const run = ctrl.createTestRun(request);
    const creationTime = new Date();
    let id: string;

    const discoverTests = async (tests: Iterable<vscodeTestItem>) => {
        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }
            const collection = getCollectionForTest(
                test.uri!,
                registeredCollections
            );
            const data = collection.testData.get(test)!;
            id = getIdForQueuedRun(data, creationTime);
            run.enqueued(test);
            queue.addToQueue({ testRun: run, test, data, id });
        }
    };

    const runTestQueue = async () => {
        if (
            queue.getOldestItemFromQueue() != undefined &&
            queue.getNumberOfItemsInQueue() > 1
        ) {
            await new Promise<void>((resolve) => {
                oldestItemChangedEmitter.event((item) => {
                    if (item.id == id) {
                        resolve();
                    }
                });
            });
        }
        const { test, data } = queue.getOldestItemFromQueue()!;
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

        run.appendOutput(`Completed ${test.label}\r\n`);
        run.end();
        queue.removeItemFromQueue({ testRun: run, test, data, id });
    };

    discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(
        runTestQueue
    );
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
