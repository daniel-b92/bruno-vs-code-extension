import { BrunoTestData } from "../testData/testDataDefinitions";
import { getCollectionRootDir } from "../../shared/fileSystem/util/collectionRootFolderHelper";
import { existsSync, lstatSync, unlinkSync } from "fs";
import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { TestDirectory } from "../testData/testDirectory";
import {
    EventEmitter,
    TestMessage,
    TestRun,
    TestItem as vscodeTestItem,
} from "vscode";
import { getTestFilesWithFailures } from "./jsonReportParser";
import { getHtmlReportPath } from "./startTestRun";
import { getTestItemDescendants } from "../vsCodeTestTree/utils/getTestItemDescendants";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import treeKill = require("tree-kill");

export async function runTestStructure(
    item: vscodeTestItem,
    data: BrunoTestData,
    options: TestRun,
    abortEmitter: EventEmitter<void>,
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
        getTestItemDescendants(item).forEach(
            (descendant) => (descendant.busy = true)
        );
    }
    const commandArgs = await getCommandArgs(
        data,
        htmlReportPath,
        jsonReportPath,
        testEnvironment
    );

    return new Promise((resolve) => {
        let duration = 0;

        const start = Date.now();
        const childProcess = spawn(`npx`, commandArgs, {
            cwd: collectionRootDir,
            shell: true,
        });

        abortEmitter.event(() => {
            while (!childProcess.pid) {
                console.error("Could not get PID of child process to kill");
            }
            treeKill(childProcess.pid);
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
                getTestItemDescendants(item).forEach((child) => {
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
                    getTestItemDescendants(item).forEach((child) => {
                        child.busy = false;
                        options.passed(child);
                    });
                }
            } else if (code == null) {
                options.skipped(item);
                if (data instanceof TestDirectory) {
                    setStatusForDescendantItems(item, jsonReportPath, options);
                }
            } else {
                if (data instanceof TestDirectory) {
                    options.failed(item, [new TestMessage("Testrun failed")]);
                    setStatusForDescendantItems(item, jsonReportPath, options);
                } else {
                    const testFilesWithFailures =
                        getTestFilesWithFailures(jsonReportPath);

                    if (
                        existsSync(jsonReportPath) &&
                        testFilesWithFailures.length > 0
                    ) {
                        const {
                            testResults,
                            assertionResults,
                            request,
                            response,
                            error,
                        } = testFilesWithFailures[0];
                        options.failed(item, [
                            getTestMessageForFailedTest(
                                testResults,
                                assertionResults,
                                request as Record<string, string | object>,
                                response as Record<string, string | object>,
                                error
                            ),
                        ]);
                    }
                }
            }
            if (existsSync(jsonReportPath)) {
                unlinkSync(jsonReportPath);
            }
            resolve();
        });
    });
}

const setStatusForDescendantItems = (
    testDirectoryItem: vscodeTestItem,
    jsonReportPath: string,
    options: TestRun
) => {
    if (!existsSync(jsonReportPath)) {
        options.appendOutput("Could not find JSON report file.\r\n");
        options.appendOutput(
            "Therefore cannot determine status of descendant test items. Will set status 'skipped' for all.\r\n"
        );
        getTestItemDescendants(testDirectoryItem).forEach((child) => {
            child.busy = false;
            options.skipped(child);
        });
        return;
    }

    const testFileDescendants = getTestItemDescendants(
        testDirectoryItem
    ).filter((descendant) => lstatSync(descendant.uri!.fsPath).isFile());

    const failedTests = getTestFilesWithFailures(jsonReportPath)
        .map((failedTest) => ({
            // 'testfile' field from the JSON report does not always match the absolute file path
            item: testFileDescendants.find((descendant) =>
                descendant.uri!.fsPath.includes(failedTest.file)
            ),
            request: failedTest.request,
            response: failedTest.response,
            testResults: failedTest.testResults,
            assertionResults: failedTest.assertionResults,
            error: failedTest.error,
        }))
        .filter((failed) => failed.item != undefined) as {
        item: vscodeTestItem;
        request: Record<string, string | object>;
        response: Record<string, string | number | object>;
        testResults: Record<string, string>[];
        assertionResults: Record<string, string>[];
        error?: string;
    }[];

    getTestItemDescendants(testDirectoryItem).forEach((child) => {
        if (!child.uri) {
            throw new Error(
                `Child directory item to run does not have a URI! Item: ${JSON.stringify(
                    child,
                    null,
                    2
                )}`
            );
        }
        const childPath = child.uri.fsPath!;
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
                    maybeTestFailure.assertionResults,
                    maybeTestFailure.request,
                    maybeTestFailure.response,
                    maybeTestFailure.error
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
    testResults: Record<string, string | number | object>[],
    assertionResults: Record<string, string | number | object>[],
    request: Record<string, string | number | object>,
    response: Record<string, string | number | object>,
    error?: string
) => {
    const linebreak = "\r\n";

    const stringifyField = (
        reportField: Record<string, string | number | object>
    ) =>
        Object.keys(reportField)
            .map((key) =>
                typeof reportField[key] == "string"
                    ? `${key}: ${reportField[key].replace(/\n/g, linebreak)}`
                    : `${key}: ${JSON.stringify(
                          reportField[key],
                          null,
                          2
                      ).replace(/\n/g, linebreak)}`
            )
            .join(linebreak);

    const formattedRequest = stringifyField(request);
    const formattedResponse = stringifyField(response);
    const formattedTestResults = testResults
        .map((result) => stringifyField(result))
        .join(linebreak);
    const formattedAssertionResults = assertionResults
        .map((result) => stringifyField(result))
        .join(linebreak);
    const dividerAndLinebreak = `---------------------------------------------${linebreak}`;

    return new TestMessage(
        `testResults:${linebreak}${formattedTestResults}${linebreak}${dividerAndLinebreak}`
            .concat(
                `assertionResults:${linebreak}${formattedAssertionResults}${linebreak}${dividerAndLinebreak}`
            )
            .concat(
                error ? `error: ${error}${linebreak}${dividerAndLinebreak}` : ""
            )
            .concat(
                `request:${linebreak}${formattedRequest}${linebreak}${dividerAndLinebreak}`
            )
            .concat(`response:${linebreak}${formattedResponse}`)
    );
};

const getJsonReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.json");

const getCommandArgs = async (
    testData: BrunoTestData,
    htmlReportPath: string,
    jsonReportPath: string,
    testEnvironment?: string
) => {
    const npmPackage = "@usebruno/cli@1.39.0";
    const testDataPath = testData.path;
    const collectionRootDir = await getCollectionRootDir(testData.path);
    const result: string[] = [];
    const argForRunCommand =
        testDataPath == collectionRootDir
            ? "bru run"
            : `bru run ${testDataPath}`;
    result.push(
        ...[
            `--package=${npmPackage}`,
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
