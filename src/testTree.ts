import { exec } from 'child_process';
import { readdirSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

export const getTestId = (uri: vscode.Uri) => uri.toString();

export const getTestLabel = (uri: vscode.Uri) => uri.path.split('/').pop()!;

export const isCollectionRootDir = (path: string) => extname(path) == '' && readdirSync(path).some((file) => file.endsWith('bruno.json'));

export const getCollectionRootDir = (testFilePath: string) => {
	let currentPath = testFilePath;

	while (!isCollectionRootDir(currentPath)) {
		currentPath = dirname(currentPath);
	}

	return currentPath;
}

export const getAncestors = (testFileOrDir: BrunoTestData) => {
	const result: {ancestorUri: vscode.Uri, childUri: vscode.Uri}[] = [];
	let currentPath = testFileOrDir.path;

	// ToDo: Fix issue with missing testcases when using all ancestors
	//while (!isCollectionRootDir(currentPath)) {
		const parentPath = dirname(currentPath);

		result.push({ancestorUri: vscode.Uri.file(parentPath), childUri: vscode.Uri.file(currentPath)});
		currentPath = parentPath;
	//}

	return result;
}

export class TestDirectory {
	constructor(public path: string) { }
	public didResolve = false;

	public async updateFromDisk(controller: vscode.TestController, directoryItem: vscode.TestItem) {
		try {
			directoryItem.error = undefined;
			this.updateFromContents(controller, directoryItem);
		} catch (e) {
			directoryItem.error = (e as Error).stack;
		}
	}

	public updateFromContents(controller: vscode.TestController, item: vscode.TestItem) {
		this.didResolve = true;

		const testDirectory = controller.createTestItem(getTestId(item.uri!), getTestLabel(item.uri!), item.uri);
		testData.set(testDirectory, this);
	}
}

export class TestFile {
	constructor(public path: string) { }
	public didResolve = false;

	public getTestId() {
		return getTestId(vscode.Uri.file(this.path));
	}

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
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
	public updateFromContents(controller: vscode.TestController, item: vscode.TestItem) {
		this.didResolve = true;

		const tcase = controller.createTestItem(getTestId(item.uri!), getTestLabel(item.uri!), item.uri);
		testData.set(tcase, this);
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const execPromise = promisify(exec);
		const collectionRootDir = getCollectionRootDir(item.uri?.fsPath!);
		const htmlReportPath = resolve(dirname(collectionRootDir), "results.html");
		const start = Date.now();
		try {
			const {stdout, stderr} = await execPromise(`cd ${collectionRootDir} && npx --package=@usebruno/cli bru run ${item.uri?.fsPath!} --reporter-html ${htmlReportPath}`);
			const duration = Date.now() - start;
			options.appendOutput(stdout.split("\n").join("\r\n"));
			options.appendOutput(stderr);
			options.appendOutput(`Results can be found here: ${htmlReportPath}\n`);
			options.passed(item, duration);
		} catch (err: any) {
			options.appendOutput(`Results can be found here: ${htmlReportPath}\n`);
			options.failed(item, [new vscode.TestMessage(err.message)]);
		}
	}
}
