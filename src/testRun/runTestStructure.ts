import { BrunoTestData } from "../testTreeHelper";
import { getCollectionRootDir } from "../fileSystem/collectionRootFolderHelper";
import { existsSync, lstatSync, unlinkSync } from "fs";
import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { TestDirectory } from "../model/testDirectory";
import { TestMessage, TestRun, TestItem as vscodeTestItem } from "vscode";
import { getTestFilesWithFailures as getFailedTests } from "./jsonReportParser";
import { getHtmlReportPath } from "./startTestRun";

export async function runTestStructure(
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

    const jsonReportPath = getJsonReportPath(collectionRootDir);
    if (existsSync(jsonReportPath)) {
        unlinkSync(jsonReportPath);
    }

    if (data instanceof TestDirectory) {
        getAllDescendants(item).forEach(
            (descendant) => (descendant.busy = true)
        );
    }
    const commandArgs = await getCommandArgs(
        item,
        htmlReportPath,
        jsonReportPath,
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
                    setStatusForDescendantItems(item, jsonReportPath, options);
                }
            }
            if (existsSync(jsonReportPath)) {
                unlinkSync(jsonReportPath);
            }
            resolve();
        });
    });
}

const setStatusForDescendantItems = async (
    testDirectoryItem: vscodeTestItem,
    jsonReportPath: string,
    options: TestRun
) => {
    const testFileDescendants = getAllDescendants(testDirectoryItem).filter(
        (descendant) => lstatSync(descendant.uri!.fsPath).isFile()
    );
    // 'testfile' field from the JSON report does not always match the absolute file path
    const failedTests = getFailedTests(jsonReportPath).map(
        ({ file, request, response, testResults }) => ({
            item: testFileDescendants.find((descendant) =>
                descendant.uri!.fsPath.includes(file)
            ) as vscodeTestItem,
            request,
            response,
            testResults,
        })
    );

    getAllDescendants(testDirectoryItem).forEach((child) => {
        const childPath = child.uri?.fsPath!;
        child.busy = false;

        const maybeTestFailure = failedTests.find((failed) =>
            failed.item.uri?.fsPath.includes(childPath)
        );

        if (!maybeTestFailure) {
            options.passed(child);
        } else if (maybeTestFailure && lstatSync(child.uri!.fsPath).isFile()) {
            // Only log details on failure for failed test file
            options.failed(
                child,
                getTestMessageForFailedTest(
                    maybeTestFailure.testResults,
                    maybeTestFailure.request,
                    maybeTestFailure.response
                )
            );
        } else {
            // For ancestor test directories only log generic message
            options.failed(
                child,
                new TestMessage("A test in the directory failed.")
            );
        }
    });
};

const getTestMessageForFailedTest = (
    testResults: string,
    request: string,
    response: string
) =>
    new TestMessage(
        `testResults:
${testResults}
request:
${request}
response:
${response}`
    );

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
            "-r",
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
