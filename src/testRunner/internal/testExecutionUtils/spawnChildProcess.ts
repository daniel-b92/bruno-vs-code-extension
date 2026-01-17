import { OutputChannelLogger } from "../../../shared";
import { ChildProcessData, UserInputData } from "../interfaces";
import { exec, spawn } from "child_process";

export function spawnChildProcess(childProcessData: ChildProcessData) {
    const { collectionRootDirectory, reportingAndOptionalData } =
        childProcessData;

    const { command, commandArguments, shouldUseNpxForTriggeringTests } =
        getCommandForCli(childProcessData);

    reportingAndOptionalData.logger?.debug(
        `Using command '${command}' and command arguments ${JSON.stringify(
            commandArguments,
            null,
            2,
        )} for triggering test run via CLI.`,
    );

    const childProcess = spawn(command, commandArguments as string[], {
        cwd: collectionRootDirectory,
        shell: true,
    });

    return { childProcess, usingNpx: shouldUseNpxForTriggeringTests };
}

function getCommandForCli({
    canUseNpx,
    collectionRootDirectory,
    jsonReportPath,
    testPath,
    useDeveloperSandbox,
    reportingAndOptionalData: {
        htmlReportPath,
        logger,
        testEnvironment,
        userInput,
    },
}: ChildProcessData) {
    const npmPackageForUsingViaNpx = `${getNpmPackageNameWithoutSpecificVersion()}@2.13.2`;

    const shouldUseNpxForTriggeringTests = shouldUseNpx(canUseNpx, logger);
    const command = shouldUseNpxForTriggeringTests ? "npx" : "bru";

    const argForRunCommand =
        testPath == collectionRootDirectory
            ? `${shouldUseNpxForTriggeringTests ? "bru " : ""}run`
            : `${shouldUseNpxForTriggeringTests ? "bru " : ""}run ${testPath}`;

    const commandArguments: string[] = ([] as string[]).concat(
        shouldUseNpxForTriggeringTests
            ? `--package=${npmPackageForUsingViaNpx}`
            : [],
        argForRunCommand,
        ...mapUserInputDataToCommandArgs(userInput),
        useDeveloperSandbox ? "--sandbox=developer" : [], // The CLI uses the sandbox 'safe' per default.
        "--reporter-html",
        htmlReportPath,
        "--reporter-json",
        jsonReportPath,
    );

    if (testEnvironment) {
        commandArguments.push(...["--env", testEnvironment]);
    }

    return { command, commandArguments, shouldUseNpxForTriggeringTests };
}

function shouldUseNpx(canUseNpx: boolean, logger?: OutputChannelLogger) {
    if (!canUseNpx) {
        return false;
    }

    let isPackageInstalledGlobally = false;

    exec("npm list -g --depth=0", (err, stdOut) => {
        if (err) {
            logger?.warn(
                `Got an unexpected error when trying to determine globally installed NPM packages: '${err.message}'`,
            );
            isPackageInstalledGlobally = false;
        } else {
            isPackageInstalledGlobally = stdOut.includes(
                getNpmPackageNameWithoutSpecificVersion(),
            );
        }
    });

    return !isPackageInstalledGlobally;
}

function mapUserInputDataToCommandArgs(userInput?: UserInputData) {
    if (!userInput) {
        return [];
    }

    const {
        excludedTags,
        includedTags,
        otherConfigs: { recursive, bail, parallel },
    } = userInput;

    const argsForTags = (
        includedTags.length > 0 ? ["--tags"].concat(includedTags) : []
    ).concat(
        excludedTags.length > 0 ? ["--exclude-tags"].concat(excludedTags) : [],
    );

    const argsForOtherConfigs = (recursive ? ["--r"] : []).concat(
        bail ? ["--bail"] : [],
        parallel ? ["--parallel"] : [],
    );

    return argsForTags.concat(argsForOtherConfigs);
}

function getNpmPackageNameWithoutSpecificVersion() {
    return "@usebruno/cli";
}
