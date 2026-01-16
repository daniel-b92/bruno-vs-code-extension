import { dirname, resolve } from "path";
import {
    EventEmitter,
    TestMessage,
    TestRun,
    Uri,
    TestItem as vscodeTestItem,
    workspace,
} from "vscode";
import { getTestFilesWithFailures } from "./testExecutionUtils/jsonReportParser";
import { getTestItemDescendants } from "../testTreeUtils/getTestItemDescendants";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import treeKill = require("tree-kill");
import { checkIfPathExistsAsync, getLinkToUserSetting } from "../../shared";
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
    },
    {
        htmlReportPath,
        logger,
        testEnvironment,
        userInput,
    }: TestRunReportingAndOptionalData,
): Promise<boolean> {
    const { abortEmitter, collectionRootDirectory, options } = additionalData;
    const path = (item.uri as Uri).fsPath;
    const lineBreak = getLineBreakForTestRunOutput();
    const isDirectory = item.canResolveChildren;

    if (await checkIfPathExistsAsync(htmlReportPath)) {
        await promisify(unlink)(htmlReportPath);
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
        const { childProcess, usingNpx } = spawnChildProcess({
            testPath: path,
            collectionRootDirectory,
            jsonReportPath,
            canUseNpx: canUseNpx(),
            reportingAndOptionalData: {
                htmlReportPath,
                testEnvironment,
                logger,
                userInput,
            },
        });

        if (!canUseNpx()) {
            options.appendOutput(lineBreak);
            options.appendOutput(
                `Temporarily installing the Bruno CLI npm package via npx is disabled (see ${getLinkToUserSetting(
                    getConfigKeyForAllowingUsageOfNpx(),
                )})${lineBreak}`,
            );
            options.appendOutput(
                `Will continue with the assumption that the package is already installed globally.${lineBreak}`,
            );
            options.appendOutput(lineBreak);
        } else {
            options.appendOutput(
                `Using ${
                    usingNpx
                        ? "npx"
                        : "the globally installed Bruno CLI package"
                } for triggering the test run.${lineBreak}`,
            );
        }

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
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `Results can be found here: ${htmlReportPath}${lineBreak}`,
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
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `HTML report has been saved in file: '${htmlReportPath}'${lineBreak}`,
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

const getJsonReportPath = (collectionRootDir: string) =>
    resolve(dirname(collectionRootDir), "results.json");

const canUseNpx = () => {
    return workspace
        .getConfiguration()
        .get<boolean>(getConfigKeyForAllowingUsageOfNpx(), false);
};
const getConfigKeyForAllowingUsageOfNpx = () =>
    "bru-as-code.allowInstallationOfBrunoCliViaNpx";

const getLineBreakForTestRunOutput = () => "\r\n";
