import { TestCollection } from "../model/testCollection";
import { BrunoTestData, getCollectionForTest } from "../testTreeHelper";
import { showHtmlReport } from "./showHtmlReport";
import { getCollectionRootDir } from "../fileSystem/collectionRootFolderHelper";
import { existsSync, unlinkSync } from "fs";
import { spawn } from "child_process";
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
    const collectionRootDir = await getCollectionRootDir(data.path);
    const htmlReportPath = getHtmlReportPath(collectionRootDir);
    if (existsSync(htmlReportPath)) {
        unlinkSync(htmlReportPath);
    }

    if (data instanceof TestDirectory) {
        getAllDescendants(item).forEach(
            (descendant) => (descendant.busy = true)
        );
    }
    const commandArgs = await getCommandArgs(
        item,
        htmlReportPath,
        getJsonReportPath(collectionRootDir),
        testEnvironment
    );

    return new Promise((resolve) => {
        let duration = 0;
        const start = Date.now();
        const childProcess = spawn(`npx`, commandArgs, {
            cwd: collectionRootDir,
        });

        childProcess.on("error", (err) => {
            console.error("Failed to start subprocess.", err);
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `Results can be found here: ${htmlReportPath}\r\n`
                );
            }

            options.appendOutput(err.message.replace(/\n/g, "\r\n"));
            options.skipped(item);

            if (data instanceof TestDirectory) {
                getAllDescendants(item).forEach((child) => {
                    child.busy = false;
                    options.skipped(child);
                });
            }
            resolve();
        });

        childProcess.stdout.on("data", (data) => {
            options.appendOutput(
                (data.toString() as string).replace(/\n/g, "\r\n")
            );
        });

        childProcess.stderr.on("data", (data) => {
            options.appendOutput(
                (data.toString() as string).replace(/\n/g, "\r\n")
            );
        });

        childProcess.on("close", (code) => {
            console.log(`child process exited with code ${code}`);
            duration = Date.now() - start;
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `HTML report has been saved in file: '${htmlReportPath}'\r\n`
                );
            }
            if (code == 0) {
                options.passed(item, duration);

                if (data instanceof TestDirectory) {
                    getAllDescendants(item).forEach((child) => {
                        child.busy = false;
                        options.passed(child);
                    });
                }
            } else {
                options.failed(item, [new TestMessage("Testrun failed")]);

                if (data instanceof TestDirectory) {
                    getAllDescendants(item).forEach((child) => {
                        child.busy = false;
                        options.failed(
                            child,
                            new TestMessage(
                                `Testrun process exited with code '${code}'.`
                            )
                        );
                    });
                }
            }

            resolve();
        });
    });
}

const getHtmlReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.html");

const getJsonReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.json");

const getCommandArgs = async (
    testItemToExecute: vscodeTestItem,
    htmlReportPath: string,
    jsonReportPath: string,
    testEnvironment?: string
) => {
    const testDataPath = testItemToExecute.uri?.fsPath!;
    const collectionRootDir = await getCollectionRootDir(testDataPath);
    const result: string[] = [];
    const argForRunCommand =
        testDataPath == collectionRootDir
            ? "bru run"
            : `bru run ${testDataPath}`;
    result.push(
        ...[
            "--package=@usebruno/cli",
            argForRunCommand,
            "--reporter-html",
            htmlReportPath,
            "--reporter-json",
            jsonReportPath,
        ]
    );

    if (testEnvironment) {
        result.push(...["--env", testEnvironment]);
    }

    return result;
};

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
