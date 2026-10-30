import {
    rememberLastHtmlReport,
    showHtmlReport,
} from "./testExecutionUtils/showHtmlReport";
import {
    EventEmitter,
    TestController,
    TestRun,
    TestRunRequest,
    Uri,
    TestItem as vscodeTestItem,
    TestItemCollection as vscodeTestItemCollection,
    window,
    workspace,
    WorkspaceConfiguration,
} from "vscode";
import { createHash } from "crypto";
import { mkdir } from "fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "path";
import {
    ResolvedBruCli,
    resolveBruCliCommand,
} from "./testExecutionUtils/resolveBruCliCommand";
import { runTestStructure } from "./runTestStructure";
import { QueuedTest, TestRunQueue } from "./testRunQueue";
import {
    TypedCollectionItemProvider,
    OutputChannelLogger,
    TypedCollection,
    getLinkToUserSetting,
} from "@shared";
import {
    checkIfPathExistsAsync,
    getConfiguredEnvironmentName,
} from "@global_shared";
import { HtmlReportLocation, TestRunUserInputData } from "./interfaces";

export const startTestRun = async (
    ctrl: TestController,
    request: TestRunRequest,
    additionalData: {
        collectionItemProvider: TypedCollectionItemProvider;
        queue: TestRunQueue;
        htmlReportStorageDir: string;
        logger?: OutputChannelLogger;
        userInput?: TestRunUserInputData;
    },
) => {
    const {
        collectionItemProvider,
        queue,
        htmlReportStorageDir,
        logger,
        userInput,
    } = additionalData;

    const discoverTests = (tests: Iterable<vscodeTestItem>) => {
        const result: QueuedTest[] = [];

        for (const test of tests) {
            if (request.exclude?.includes(test)) {
                continue;
            }

            const path = (test.uri as Uri).fsPath;
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(path);

            if (!collection) {
                throw new Error(
                    `Did not find registered collection for item with Uri '${JSON.stringify(
                        test.uri,
                        null,
                        2,
                    )}'`,
                );
            }

            const id = getIdForQueuedRun(path, new Date());

            result.push({
                request,
                test,
                id,
                abortEmitter: new EventEmitter<void>(),
            });
        }

        return result;
    };

    const runTestQueue = async (toRun: QueuedTest[]) => {
        let nextItemToRun = queue.getNextTestThatCanStartRunning(toRun);
        for (const item of toRun) {
            queue.addToQueue(item);
        }

        while (toRun.length > 0) {
            const {
                run,
                queuedTest: { id, test, abortEmitter },
            } = await nextItemToRun;
            const path = (test.uri as Uri).fsPath;

            const collectionRootDir = (
                collectionItemProvider.getAncestorCollectionForPath(
                    path,
                ) as TypedCollection
            ).getRootDirectory();

            const htmlReport = await getHtmlReportLocation(
                collectionRootDir,
                htmlReportStorageDir,
            );

            run.token.onCancellationRequested(() => {
                abortEmitter.fire();
                run.appendOutput(`Canceled ${test.label}\r\n`);
                run.skipped(test);

                queue.removeItemsFromQueue(toRun.splice(0));
            });

            const { didRun, passed } = await prepareAndRunTest(
                { test, abortEmitter, id, request },
                run,
                {
                    collectionRootDirectory: collectionRootDir,
                    htmlReport,
                    logger,
                    userInput,
                },
            );

            if (!didRun) {
                // Remaining tests would never start otherwise and would block subsequent test runs.
                for (const { test: remaining } of toRun) {
                    run.skipped(remaining);
                }
                queue.removeItemsFromQueue(toRun.splice(0));
                run.end();
                break;
            }

            run.end();

            if (
                didRun &&
                passed != undefined &&
                htmlReport &&
                (await checkIfPathExistsAsync(htmlReport.path))
            ) {
                rememberLastHtmlReport(htmlReport.path, path);

                if (shouldShowHtmlReport(passed)) {
                    await showHtmlReport(htmlReport.path, path);
                }
            }

            nextItemToRun = queue.getNextTestThatCanStartRunning(toRun);

            queue.removeItemsFromQueue([
                {
                    request,
                    test,
                    id,
                    abortEmitter,
                },
            ]);
            toRun.splice(
                toRun.findIndex(({ id: idForMatching }) => idForMatching == id),
                1,
            );
        }
    };

    const toRun = discoverTests(request.include ?? gatherTestItems(ctrl.items));
    await runTestQueue(toRun);
};

const prepareAndRunTest = async (
    { test, abortEmitter }: QueuedTest,
    run: TestRun,
    additionalData: {
        collectionRootDirectory: string;
        htmlReport?: HtmlReportLocation;
        logger?: OutputChannelLogger;
        userInput?: TestRunUserInputData;
    },
): Promise<{ didRun: boolean; passed?: boolean }> => {
    const { collectionRootDirectory, htmlReport, logger, userInput } =
        additionalData;

    if (checkForRequestedCancellation(run)) {
        run.end();
        return { didRun: false };
    }

    run.appendOutput(`Running ${test.label}\r\n`);

    run.started(test);

    const testEnvironment = getConfiguredEnvironmentName(
        collectionRootDirectory,
        (sectionKey) => workspace.getConfiguration().get(sectionKey),
    );

    const cli = resolveCli(collectionRootDirectory);

    if (cli.source == "invalidSetting") {
        const message = `The Bruno CLI configured via setting ${cliPathConfigKey} ('${cli.configuredPath}') does not exist.`;
        window.showErrorMessage(message);
        run.appendOutput(`${message}\r\n`);
        run.skipped(test);
        return { didRun: false };
    }

    printInfosOnTestRunStart(run, htmlReport, testEnvironment, cli);

    if (checkForRequestedCancellation(run)) {
        run.end();
        return { didRun: false };
    }

    const passed = await runTestStructure(
        test,
        {
            options: run,
            abortEmitter,
            collectionRootDirectory,
            cliCommand: cli.command,
            useDeveloperSandbox: canUseDeveloperSandbox(),
        },
        {
            htmlReport,
            testEnvironment,
            logger,
            userInput,
        },
    );

    return { didRun: true, passed };
};

const checkForRequestedCancellation = (run: TestRun) =>
    run.token.isCancellationRequested;

const getIdForQueuedRun = (itemPath: string, creationTime: Date) =>
    `${itemPath}@${creationTime.toISOString()}`;

const printInfosOnTestRunStart = (
    run: TestRun,
    htmlReport: HtmlReportLocation | undefined,
    testEnvironment: string | undefined,
    cli: Exclude<ResolvedBruCli, { source: "invalidSetting" }>,
) => {
    const lineBreak = "\r\n";
    run.appendOutput(
        cli.source == "global"
            ? `Using the Bruno CLI from the PATH.${lineBreak}`
            : `Using the Bruno CLI '${cli.command}' (${cli.source == "setting" ? `due to user setting ${getLinkToUserSetting(cliPathConfigKey)}` : "local installation"}).${lineBreak}`,
    );
    if (!testEnvironment) {
        run.appendOutput(
            `Not using any environment for the test run.${lineBreak}`,
        );
        run.appendOutput(
            `You can configure an environment by clicking on the root folder of the collection in the collection explorer.${lineBreak}`,
        );
    } else {
        run.appendOutput(
            `Using the test environment '${testEnvironment}'.${lineBreak}`,
        );
    }

    if (htmlReport?.isConfiguredByUser) {
        run.appendOutput(
            `Saving the HTML test report to file '${htmlReport.path}' due to user setting ${getLinkToUserSetting(htmlReportPathConfigKey)}${lineBreak}`,
        );
    }
    run.appendOutput(
        `${canUseDeveloperSandbox() ? "Using" : "Not using"} Javascript sandbox developer mode due to user setting ${getLinkToUserSetting(getConfigKeyForSandboxDeveloperMode())}${lineBreak}`,
    );
    run.appendOutput(lineBreak);
    run.appendOutput(`Starting test run ....${lineBreak}`);
    run.appendOutput(
        "-----------------------------------------------------------",
    );
    run.appendOutput(lineBreak);
};

function gatherTestItems(collection: vscodeTestItemCollection) {
    const items: vscodeTestItem[] = [];
    collection.forEach((item) => items.push(item));
    return items;
}

const cliPathConfigKey = "bru-as-code.cliPath";

const resolveCli = (collectionRootDirectory: string) => {
    const uri = Uri.file(collectionRootDirectory);

    return resolveBruCliCommand({
        configuredPath: workspace
            .getConfiguration(undefined, uri)
            .get<string>(cliPathConfigKey),
        collectionRootDirectory,
        workspaceFolderPath:
            workspace.getWorkspaceFolder(uri)?.uri.fsPath ??
            collectionRootDirectory,
    });
};

const htmlReportPathConfigKey = "bru-as-code.htmlReportPath";

/**
 * @returns `undefined`, if no HTML report is needed (i.e. the user did not configure a path and does not want to see reports)
 */
const getHtmlReportLocation = async (
    collectionRootDir: string,
    htmlReportStorageDir: string,
): Promise<HtmlReportLocation | undefined> => {
    const configValue = workspace
        .getConfiguration()
        .get<string>(htmlReportPathConfigKey)
        ?.trim();

    if (configValue) {
        const configuredPath = await resolveConfiguredHtmlReportPath(
            configValue,
            collectionRootDir,
        );

        if (configuredPath) {
            return { path: configuredPath, isConfiguredByUser: true };
        }

        window.showWarningMessage(
            `Configured HTML report path '${configValue}' is invalid or missing. The report will not be saved to that path.`,
        );
    }

    if (getShowHtmlReportSetting() == "never") {
        return undefined;
    }

    await mkdir(htmlReportStorageDir, { recursive: true });

    // Keep only the last report per collection.
    const collectionHash = createHash("sha1")
        .update(collectionRootDir)
        .digest("hex")
        .slice(0, 12);

    return {
        path: join(htmlReportStorageDir, `report-${collectionHash}.html`),
        isConfiguredByUser: false,
    };
};

const resolveConfiguredHtmlReportPath = async (
    configValue: string,
    collectionRootDir: string,
) => {
    if (extname(configValue) != ".html") {
        return undefined;
    }

    const absolutePath = isAbsolute(configValue)
        ? configValue
        : resolve(collectionRootDir, configValue);

    return (await checkIfPathExistsAsync(dirname(absolutePath)))
        ? absolutePath
        : undefined;
};

type ShowHtmlReportSetting = "always" | "onFailure" | "never";

const showHtmlReportConfigKey = "bru-as-code.showHtmlReport";
const removedAlwaysShowHtmlReportConfigKey = "bru-as-code.alwaysShowHtmlReport";

const getShowHtmlReportSetting = (): ShowHtmlReportSetting => {
    const config = workspace.getConfiguration();

    if (hasExplicitValue(config.inspect(showHtmlReportConfigKey))) {
        return config.get<ShowHtmlReportSetting>(
            showHtmlReportConfigKey,
            "onFailure",
        );
    }

    // Migration: The removed setting is no longer registered, but configured values can still be read.
    // Only an explicit `true` differs from the new default.
    const removedSetting = config.inspect<boolean>(
        removedAlwaysShowHtmlReportConfigKey,
    );

    return [
        removedSetting?.workspaceFolderValue,
        removedSetting?.workspaceValue,
        removedSetting?.globalValue,
    ].find((value) => value !== undefined) === true
        ? "always"
        : "onFailure";
};

const hasExplicitValue = (
    inspected: ReturnType<WorkspaceConfiguration["inspect"]>,
) =>
    inspected?.workspaceFolderValue !== undefined ||
    inspected?.workspaceValue !== undefined ||
    inspected?.globalValue !== undefined;

const shouldShowHtmlReport = (testsPassed: boolean) => {
    const setting = getShowHtmlReportSetting();

    return setting == "always" || (setting == "onFailure" && !testsPassed);
};

function canUseDeveloperSandbox() {
    return workspace
        .getConfiguration()
        .get<boolean>(getConfigKeyForSandboxDeveloperMode(), false);
}

function getConfigKeyForSandboxDeveloperMode() {
    return "bru-as-code.sandboxDeveloperMode";
}
