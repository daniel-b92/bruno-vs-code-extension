import { TestCollection } from "../model/testCollection";
import { BrunoTestData, getCollectionForTest } from "../testTreeHelper";
import { showHtmlReport } from "./showHtmlReport";
import { getCollectionRootDir } from "../fileSystem/collectionRootFolderHelper";
import { existsSync } from "fs";
import {
    TestController,
    TestRunRequest,
    TestItem as vscodeTestItem,
    TestItemCollection as vscodeTestItemCollection,
    workspace,
} from "vscode";
import { dirname, resolve } from "path";
import { runTestStructure } from "./runTestStructure";

const environmentConfigKey = "brunoTestExtension.testRunEnvironment";

export const startTestRun = (
    ctrl: TestController,
    request: TestRunRequest,
    testCollections: TestCollection[]
) => {
    const queue: { test: vscodeTestItem; data: BrunoTestData }[] = [];
    const run = ctrl.createTestRun(request);

    const discoverTests = async (tests: Iterable<vscodeTestItem>) => {
        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }

            const collection = getCollectionForTest(test.uri!, testCollections);
            const data = collection.testData.get(test)!;
            run.enqueued(test);
            queue.push({ test, data });
        }
    };

    const runTestQueue = async () => {
        for (const { test, data } of queue) {
            run.appendOutput(`Running ${test.label}\r\n`);
            if (run.token.isCancellationRequested) {
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);
            } else {
                run.started(test);
                const testEnvironment = workspace
                    .getConfiguration()
                    .get(environmentConfigKey) as string | undefined;
                const htmlReportPath = getHtmlReportPath(
                    await getCollectionRootDir(data.path)
                );
                if (!testEnvironment) {
                    run.appendOutput(
                        `Not using any environment for the test run.\r\n`
                    );
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
                await runTestStructure(test, data, run, testEnvironment);
                if (existsSync(htmlReportPath)) {
                    showHtmlReport(htmlReportPath, data);
                }
            }

            run.appendOutput(`Completed ${test.label}\r\n`);
        }

        run.end();
    };

    discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(
        runTestQueue
    );
};

export const getHtmlReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.html");

function gatherTestItems(collection: vscodeTestItemCollection) {
    const items: vscodeTestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}
