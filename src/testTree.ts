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

    async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
        const execPromise = promisify(exec);
        const collectionRootDir = getCollectionRootDir(item.uri?.fsPath!);
        const htmlReportPath = resolve(
            dirname(collectionRootDir),
            "results.html"
        );
        if (existsSync(htmlReportPath)) {
            unlinkSync(htmlReportPath);
        }

        const start = Date.now();
        try {
            const { stdout, stderr } = await execPromise(
                `cd ${collectionRootDir} && npx --package=@usebruno/cli bru run ${item
                    .uri?.fsPath!} --reporter-html ${htmlReportPath}`
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
        } catch (err: any) {
            if (existsSync(htmlReportPath)) {
                options.appendOutput(
                    `Results can be found here: ${htmlReportPath}\r\n`
                );
            }
            options.failed(item, [new vscode.TestMessage(err.message)]);
        }
    }
}
