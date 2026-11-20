import { dirname, resolve } from "path";
import {
    EventEmitter,
    TestMessage,
    TestRun,
    Uri,
    TestItem as vscodeTestItem,
} from "vscode";
import { getTestFilesWithFailures } from "./testExecutionUtils/jsonReportParser";
import { getTestItemDescendants } from "../testTreeUtils/getTestItemDescendants";
import treeKill = require("tree-kill");
import { checkIfPathExistsAsync } from "@global_shared";
import { existsSync, unlink, unlinkSync } from "fs";
import { promisify } from "util";
import { TestRunReportingAndOptionalData } from "./interfaces";
import { spawnChildProcess } from "./testExecutionUtils/spawnChildProcess";
import { setStatusForDescendantItems } from "./testExecutionUtils/setStatusForDescendantItems";
import { getTestMessageForFailedTest } from "./testExecutionUtils/getTestMessageForFailedTest";

export async function runTestStructure(
    item: vscodeTestItem,
    additionalData: {
        options: TestRun;
        abortEmitter: EventEmitter<void>;
        collectionRootDirectory: string;
        cliCommand: string;
        useDeveloperSandbox: boolean;
    },
    {
        htmlReport,
        logger,
        testEnvironment,
        userInput,
    }: TestRunReportingAndOptionalData,
): Promise<boolean> {
    const {
        abortEmitter,
        cliCommand,
        collectionRootDirectory,
        options,
        useDeveloperSandbox,
    } = additionalData;
    const path = (item.uri as Uri).fsPath;
    const lineBreak = getLineBreakForTestRunOutput();
    const isDirectory = item.canResolveChildren;

    if (htmlReport && (await checkIfPathExistsAsync(htmlReport.path))) {
        await promisify(unlink)(htmlReport.path);
    }

    const jsonReportPath = getJsonReportPath(collectionRootDirectory);
    if (await checkIfPathExistsAsync(jsonReportPath)) {
        await promisify(unlink)(jsonReportPath);
    }

    if (isDirectory) {
        getTestItemDescendants(item).forEach(
            (descendant) => (descendant.busy = true),
        );
    }

    return new Promise<boolean>((resolve) => {
        let duration = 0;

        const start = Date.now();
        const { childProcess } = spawnChildProcess({
            testPath: path,
            cliCommand,
            collectionRootDirectory,
            jsonReportPath,
            useDeveloperSandbox,
            reportingAndOptionalData: {
                htmlReport,
                testEnvironment,
                logger,
                userInput,
            },
        });

        abortEmitter.event(() => {
            while (!childProcess.pid) {
                logger?.error(
                    "Could not get PID of child process to kill for test run.",
                );
            }
            treeKill(childProcess.pid);
        });

        childProcess.on("error", (err) => {
            logger?.error("Failed to start subprocess.", err);
            if (htmlReport?.isConfiguredByUser && existsSync(htmlReport.path)) {
                options.appendOutput(
                    `Results can be found here: ${htmlReport.path}${lineBreak}`,
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
                (data.toString() as string).replace(/\n/g, lineBreak),
            );
        });

        childProcess.stderr.on("data", (data) => {
            options.appendOutput(
                (data.toString() as string).replace(/\n/g, lineBreak),
            );
        });

        childProcess.on("close", (exitCode) => {
            logger?.info(
                `Child process for test run exited with code ${exitCode}`,
            );
            duration = Date.now() - start;
            if (htmlReport?.isConfiguredByUser && existsSync(htmlReport.path)) {
                options.appendOutput(
                    `HTML report has been saved in file: '${htmlReport.path}'${lineBreak}`,
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
                    setStatusForDescendantItems(
                        item,
                        jsonReportPath,
                        options,
                        getLineBreakForTestRunOutput(),
                    );
                }
            } else {
                if (isDirectory) {
                    options.failed(item, [new TestMessage("Testrun failed")]);
                    setStatusForDescendantItems(
                        item,
                        jsonReportPath,
                        options,
                        getLineBreakForTestRunOutput(),
                    );
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
                                {
                                    testResults,
                                    assertionResults,
                                    request: request as Record<
                                        string,
                                        string | object
                                    >,
                                    response: response as Record<
                                        string,
                                        string | object
                                    >,
                                    error,
                                },
                                getLineBreakForTestRunOutput(),
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

function getJsonReportPath(collectionRootDir: string) {
    return resolve(dirname(collectionRootDir), "results.json");
}

const getLineBreakForTestRunOutput = () => "\r\n";
