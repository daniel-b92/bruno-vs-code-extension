import { TestCollection } from "../model/testCollection";
import { BrunoTestData, getCollectionForTest } from "../testTreeHelper";
import { showHtmlReport } from "./showHtmlReport";
import { getCollectionRootDir } from "../fileSystem/collectionRootFolderHelper";
import { existsSync, unlinkSync } from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import { dirname, resolve } from "path";
import { TestDirectory } from "../model/testDirectory";
import {
    TestController,
    TestMessage,
    TestRun,
    TestRunRequest,
    TestItem as vscodeTestItem,
    TestItemCollection as vscodeTestItemCollection,
    workspace,
} from "vscode";

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

function gatherTestItems(collection: vscodeTestItemCollection) {
    const items: vscodeTestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}

async function runTestStructure(
    item: vscodeTestItem,
    data: BrunoTestData,
    options: TestRun,
    testEnvironment?: string
): Promise<void> {
    const getAllDescendants = (testItem: vscodeTestItem) => {
        let result: vscodeTestItem[] = [];
        let currentChildItems = Array.from(testItem.children).map(
            (item) => item[1]
        );

        while (currentChildItems.length > 0) {
            result = result.concat(currentChildItems);
            const nextDepthLevelDescendants: vscodeTestItem[] = [];

            currentChildItems.forEach((item) =>
                item.children.forEach((child) => {
                    nextDepthLevelDescendants.push(child);
                })
            );

            currentChildItems = nextDepthLevelDescendants;
        }

        return result;
    };

    const getCommandToExecute = async (
        testPathToExecute: string,
        htmlReportPath: string,
        jsonReportPath: string
    ) => {
        const collectionRootDir = await getCollectionRootDir(testPathToExecute);
        let result: string;

        if (testPathToExecute == collectionRootDir) {
            result = `cd ${collectionRootDir} && npx --package=@usebruno/cli bru run --reporter-html ${htmlReportPath} --reporter-json ${jsonReportPath}`;
        } else {
            result = `cd ${collectionRootDir} && npx --package=@usebruno/cli bru run ${testPathToExecute} --reporter-html ${htmlReportPath} --reporter-json ${jsonReportPath}`;
        }

        if (testEnvironment) {
            result = result.concat(` --env ${testEnvironment}`);
        }

        return result;
    };

    const execPromise = promisify(exec);
    const collectionRootDir = await getCollectionRootDir(data.path);
    const htmlReportPath = getHtmlReportPath(collectionRootDir);
    const jsonReportPath = resolve(dirname(collectionRootDir), "results.json");
    if (existsSync(htmlReportPath)) {
        unlinkSync(htmlReportPath);
    }

    if (data instanceof TestDirectory) {
        getAllDescendants(item).forEach(
            (descendant) => (descendant.busy = true)
        );
    }

    const start = Date.now();
    try {
        const command = await getCommandToExecute(
            data.path,
            htmlReportPath,
            jsonReportPath
        );
        const { stdout, stderr } = await execPromise(command);
        const duration = Date.now() - start;
        options.appendOutput(stdout.replace(/\n/g, "\r\n"));
        options.appendOutput(stderr.replace(/\n/g, "\r\n"));

        if (existsSync(htmlReportPath)) {
            options.appendOutput(
                `HTML report has been saved in file: '${htmlReportPath}'\r\n`
            );
        }
        options.passed(item, duration);

        if (data instanceof TestDirectory) {
            getAllDescendants(item).forEach((child) => {
                child.busy = false;
                options.passed(child);
            });
        }
    } catch (err: any) {
        if (existsSync(htmlReportPath)) {
            options.appendOutput(
                `Results can be found here: ${htmlReportPath}\r\n`
            );
        }

        const testMessage = new TestMessage(`${err.stdout}\n${err.stderr}`);
        options.failed(item, [testMessage]);

        if (data instanceof TestDirectory) {
            getAllDescendants(item).forEach((child) => {
                child.busy = false;
                options.skipped(child);
            });
        }
    } finally {
        if (existsSync(jsonReportPath)) {
            unlinkSync(jsonReportPath);
        }
    }
}

const getHtmlReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.html");
