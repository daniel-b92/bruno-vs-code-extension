import { TestRunChildProcessData, TestRunUserInputData } from "../interfaces";
import { spawn } from "child_process";

export function spawnChildProcess(childProcessData: TestRunChildProcessData) {
    const { collectionRootDirectory, reportingAndOptionalData } =
        childProcessData;

    const { command, commandArguments } = getCommandForCli(childProcessData);

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

    return { childProcess };
}

function getCommandForCli({
    cliCommand,
    collectionRootDirectory,
    jsonReportPath,
    testPath,
    useDeveloperSandbox,
    reportingAndOptionalData: { htmlReport, testEnvironment, userInput },
}: TestRunChildProcessData) {
    const argForRunCommand = "run".concat(
        testPath == collectionRootDirectory ? "" : ` ${quote(testPath)}`,
    );

    const commandArguments: string[] = [argForRunCommand].concat(
        ...mapUserInputDataToCommandArgs(userInput),
        useDeveloperSandbox ? "--sandbox=developer" : [], // The CLI uses the sandbox 'safe' per default.
        htmlReport ? ["--reporter-html", quote(htmlReport.path)] : [],
        "--reporter-json",
        quote(jsonReportPath),
    );

    if (testEnvironment) {
        commandArguments.push(...["--env", quote(testEnvironment)]);
    }

    return { command: quote(cliCommand), commandArguments };
}

// The process is spawned with `shell: true`, so values containing whitespace (e.g. paths) need to be quoted.
function quote(value: string) {
    return `"${value}"`;
}

function mapUserInputDataToCommandArgs(userInput?: TestRunUserInputData) {
    const recursiveOption = "-r";

    if (!userInput) {
        // Use recursive option per default
        return [recursiveOption];
    }

    const {
        excludedTags,
        includedTags,
        otherConfigs: { recursive, bail, parallel },
    } = userInput;

    const argsForTags = (
        includedTags.length > 0
            ? ["--tags"].concat(quote(includedTags.join(",")))
            : []
    ).concat(
        excludedTags.length > 0
            ? ["--exclude-tags"].concat(quote(excludedTags.join(",")))
            : [],
    );

    const argsForOtherConfigs = (recursive ? [recursiveOption] : []).concat(
        bail ? ["--bail"] : [],
        parallel ? ["--parallel"] : [],
    );

    return argsForTags.concat(argsForOtherConfigs);
}
