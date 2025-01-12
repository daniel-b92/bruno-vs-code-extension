import { exec } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { dirname, resolve } from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { TestDirectory } from "./model/testDirectory";
import { BrunoTestData, getCollectionRootDir } from "./testTreeHelper";
import { getHtmlReportPath } from "./htmlReportHelper";

export const environmentConfigKey = "brunoTestExtension.testRunEnvironment";

export async function runTestStructure(
    item: vscode.TestItem,
    data: BrunoTestData,
    options: vscode.TestRun,
    testEnvironment?: string
): Promise<void> {
    const getAllDescendants = (testItem: vscode.TestItem) => {
        let result: vscode.TestItem[] = [];
        let currentChildItems = Array.from(testItem.children).map(
            (item) => item[1]
        );

        while (currentChildItems.length > 0) {
            result = result.concat(currentChildItems);
            const nextDepthLevelDescendants: vscode.TestItem[] = [];

            currentChildItems.forEach((item) =>
                item.children.forEach((child) => {
                    nextDepthLevelDescendants.push(child);
                })
            );

            currentChildItems = nextDepthLevelDescendants;
        }

        return result;
    };

    const getCommandToExecute = (
        testPathToExecute: string,
        htmlReportPath: string,
        jsonReportPath: string
    ) => {
        const collectionRootDir = getCollectionRootDir(testPathToExecute);
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
    const collectionRootDir = getCollectionRootDir(data.path);
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
        const { stdout, stderr } = await execPromise(
            getCommandToExecute(data.path, htmlReportPath, jsonReportPath)
        );
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

        const testMessage = new vscode.TestMessage(
            `${err.stdout}\n${err.stderr}`
        );
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
