import { exec } from "child_process";
import { existsSync, readdirSync, unlinkSync } from "fs";
import { dirname, extname, resolve } from "path";
import { promisify } from "util";
import * as vscode from "vscode";

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

export const getTestfilesForCollection = async (collectionRootDir: string) => {
    return await vscode.workspace.findFiles(
        new vscode.RelativePattern(collectionRootDir, globPatternForTestfiles)
    );
};

export const getTestId = (uri: vscode.Uri) => uri.toString();

export const getTestLabel = (uri: vscode.Uri) => uri.path.split("/").pop()!;

export const isCollectionRootDir = (path: string) =>
    extname(path) == "" &&
    readdirSync(path).some((file) => file.endsWith("bruno.json"));

export const getCollectionRootDir = (testFilePath: string) => {
    let currentPath = testFilePath;

    while (!isCollectionRootDir(currentPath)) {
        currentPath = dirname(currentPath);
    }

    return currentPath;
};

export async function runTestStructure(
    item: vscode.TestItem,
    data: BrunoTestData,
    options: vscode.TestRun
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

        if (testPathToExecute == collectionRootDir) {
            return `cd ${collectionRootDir} && npx --package=@usebruno/cli bru run --reporter-html ${htmlReportPath} --reporter-json ${jsonReportPath}`;
        } else {
            return `cd ${collectionRootDir} && npx --package=@usebruno/cli bru run ${testPathToExecute} --reporter-html ${htmlReportPath} --reporter-json ${jsonReportPath}`;
        }
    };

    const execPromise = promisify(exec);
    const collectionRootDir = getCollectionRootDir(data.path);
    const htmlReportPath = resolve(dirname(collectionRootDir), "results.html");
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
                `Results can be found here: ${htmlReportPath}\r\n`
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

export class TestDirectory {
    constructor(public path: string) {}
    public didResolve = false;

    public async updateFromDisk(
        controller: vscode.TestController,
        directoryItem: vscode.TestItem
    ) {
        try {
            directoryItem.error = undefined;
            this.updateFromContents(controller, directoryItem);
        } catch (e) {
            directoryItem.error = (e as Error).stack;
        }
    }

    public updateFromContents(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        this.didResolve = true;

        const testDirectory = controller.createTestItem(
            getTestId(item.uri!),
            getTestLabel(item.uri!),
            item.uri
        );
        testData.set(testDirectory, this);
    }
}

export class TestFile {
    constructor(public path: string) {}
    public didResolve = false;

    public getTestId() {
        return getTestId(vscode.Uri.file(this.path));
    }

    public async updateFromDisk(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        try {
            item.error = undefined;
            this.updateFromContents(controller, item);
        } catch (e) {
            item.error = (e as Error).stack;
        }
    }

    /**
     * Parses the tests from the input text, and updates the tests contained
     * by this file to be those from the text,
     */
    public updateFromContents(
        controller: vscode.TestController,
        item: vscode.TestItem
    ) {
        this.didResolve = true;

        const tcase = controller.createTestItem(
            getTestId(item.uri!),
            getTestLabel(item.uri!),
            item.uri
        );
        testData.set(tcase, this);
    }
}
