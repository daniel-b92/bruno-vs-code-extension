import { existsSync, lstatSync, unlinkSync } from "fs";
import { exec, spawn } from "child_process";
import { dirname, resolve } from "path";
import {
    EventEmitter,
    TestMessage,
    TestRun,
    Uri,
    TestItem as vscodeTestItem,
    workspace,
} from "vscode";
import { getTestFilesWithFailures } from "./jsonReportParser";
import { getTestItemDescendants } from "../testTreeUtils/getTestItemDescendants";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import treeKill = require("tree-kill");
import { getLinkToUserSetting } from "../../shared";

export async function runTestStructure(
    item: vscodeTestItem,
    options: TestRun,
    abortEmitter: EventEmitter<void>,
    collectionRootDirectory: string,
    htmlReportPath: string,
    testEnvironment?: string
): Promise<boolean> {
    const path = (item.uri as Uri).fsPath;
    const lineBreak = getLineBreakForTestRunOutput();
    const isDirectory = item.canResolveChildren;

    if (existsSync(htmlReportPath)) {
        unlinkSync(htmlReportPath);
    }

    const jsonReportPath = getJsonReportPath(collectionRootDirectory);
    if (existsSync(jsonReportPath)) {
        unlinkSync(jsonReportPath);
    }

    if (isDirectory) {
        getTestItemDescendants(item).forEach(
            (descendant) => (descendant.busy = true)
        );
    }

    return new Promise<boolean>((resolve) => {
        let duration = 0;

        const start = Date.now();
        const { childProcess, usingNpx } = spawnChildProcess(
            path,
            collectionRootDirectory,
            htmlReportPath,
            jsonReportPath,
            testEnvironment
        );

        if (!canUseNpx()) {
            options.appendOutput(lineBreak);
            options.appendOutput(
                `Temporarily installing the Bruno CLI npm package via npx is disabled (see ${getLinkToUserSetting(
                    getConfigKeyForAllowingUsageOfNpx()
                )})${lineBreak}`
            );
            options.appendOutput(
                `Will continue with the assumption that the package is already installed globally.${lineBreak}`
            );
            options.appendOutput(lineBreak);
        } else {
            options.appendOutput(
                `Using ${
                    usingNpx
                        ? "npx"
                        : "the globally installed Bruno CLI package"
                } for triggering the test run.${lineBreak}`
            );
        }

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
                    `Results can be found here: ${htmlReportPath}${lineBreak}`
                );
            }

            options.appendOutput(err.message.replace(/\n/g, lineBreak));
            options.skipped(item);

            if (isDirectory) {
                getTestItemDescendants(item).forEach((child) => {
                    child.busy = false;
                    options.skipped(child);
                });
            }
            resolve(false);
        });

        childProcess.stdout.on("data", (data) => {
            options.appendOutput(
                (data.toString() as string).replace(/\n/g, lineBreak)
            );
        });

        childProcess.stderr.on("data", (data) => {
            options.appendOutput(
                (data.toString() as string).replace(/\n/g, lineBreak)
            );
        });

        childProcess.on("close", (exitCode) => {
            console.log(`child process exited with code ${exitCode}`);
            duration = Date.now() - start;
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `HTML report has been saved in file: '${htmlReportPath}'${lineBreak}`
                );
            }
            if (exitCode == 0) {
                options.passed(item, duration);

                if (isDirectory) {
                    getTestItemDescendants(item).forEach((child) => {
                        child.busy = false;
                        options.passed(child);
                    });
                }
            } else if (exitCode == null) {
                options.skipped(item);
                if (isDirectory) {
                    setStatusForDescendantItems(item, jsonReportPath, options);
                }
            } else {
                if (isDirectory) {
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
            resolve(exitCode == 0);
        });
    });
}

const setStatusForDescendantItems = (
    testDirectoryItem: vscodeTestItem,
    jsonReportPath: string,
    options: TestRun
) => {
    if (!existsSync(jsonReportPath)) {
        options.appendOutput(
            `Could not find JSON report file.${getLineBreakForTestRunOutput()}`
        );
        options.appendOutput(
            `Therefore cannot determine status of descendant test items. Will set status 'skipped' for all.${getLineBreakForTestRunOutput()}`
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
    const linebreak = getLineBreakForTestRunOutput();

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
        (testResults.length > 0
            ? `${dividerAndLinebreak}testResults:${linebreak}${formattedTestResults}${linebreak}${dividerAndLinebreak}`
            : ""
        ).concat(
            assertionResults.length > 0
                ? `assertionResults:${linebreak}${formattedAssertionResults}${linebreak}${dividerAndLinebreak}`
                : "",
            error ? `error: ${error}${linebreak}${dividerAndLinebreak}` : "",
            `request:${linebreak}${formattedRequest}${linebreak}${dividerAndLinebreak}`,
            `response:${linebreak}${formattedResponse}${linebreak}${dividerAndLinebreak}`
        )
    );
};

const getJsonReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.json");

const spawnChildProcess = (
    testPath: string,
    collectionRootDirectory: string,
    htmlReportPath: string,
    jsonReportPath: string,
    testEnvironment?: string
) => {
    const npmPackageForUsingViaNpx = `${getNpmPackageNameWithoutSpecificVersion()}@2.3.0`;

    const commandArguments: (string | undefined)[] = [];
    const shouldUseNpxForTriggeringTests = shouldUseNpx();
    const command = shouldUseNpxForTriggeringTests ? "npx" : "bru";
    const argForRunCommand =
        testPath == collectionRootDirectory
            ? `${shouldUseNpxForTriggeringTests ? "bru " : ""}run`
            : `${shouldUseNpxForTriggeringTests ? "bru " : ""}run ${testPath}`;

    commandArguments.push(
        ...[
            shouldUseNpxForTriggeringTests
                ? `--package=${npmPackageForUsingViaNpx}`
                : undefined,
            argForRunCommand,
            "-r",
            "--reporter-html",
            htmlReportPath,
            "--reporter-json",
            jsonReportPath,
        ].filter((entry) => entry != undefined)
    );

    if (testEnvironment) {
        commandArguments.push(...["--env", testEnvironment]);
    }

    const childProcess = spawn(command, commandArguments as string[], {
        cwd: collectionRootDirectory,
        shell: true,
    });

    return { childProcess, usingNpx: shouldUseNpxForTriggeringTests };
};

const shouldUseNpx = () => {
    if (!canUseNpx()) {
        return false;
    }

    let isPackageInstalledGlobally = false;

    exec("npm list -g --depth=0", (err, stdOut) => {
        if (err) {
            console.warn(
                `Got an unexpected error when trying to determine globally installed NPM packages: '${err.message}'`
            );
            isPackageInstalledGlobally = false;
        } else {
            isPackageInstalledGlobally = stdOut.includes(
                getNpmPackageNameWithoutSpecificVersion()
            );
        }
    });

    return !isPackageInstalledGlobally;
};

const canUseNpx = () => {
    return workspace
        .getConfiguration()
        .get<boolean>(getConfigKeyForAllowingUsageOfNpx(), false);
};

const getLineBreakForTestRunOutput = () => "\r\n";

const getNpmPackageNameWithoutSpecificVersion = () => "@usebruno/cli";

const getConfigKeyForAllowingUsageOfNpx = () =>
    "bru-as-code.allowInstallationOfBrunoCliViaNpx";
