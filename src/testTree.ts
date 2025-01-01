import { readdirSync } from 'fs';
import { dirname, extname } from 'path';
import * as vscode from 'vscode';

export const globPatternForTestfiles = "**/*.bru";
export type BrunoTestData = TestDirectory | TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

export const getTestId = (uri: vscode.Uri) => uri.toString();

export const getTestLabel = (uri: vscode.Uri) => uri.path.split('/').pop()!;

export const getAncestors = (testData: BrunoTestData) => {
	const isCollectionRootDir = (path: string) => extname(path) == '' && readdirSync(path).some((file) => file.endsWith('bruno.json'));

	const result: {ancestorUri: vscode.Uri, childUri: vscode.Uri}[] = [];
	let currentPath = testData.path;

	while (!isCollectionRootDir(currentPath)) {
		const parentPath = dirname(currentPath);

		result.push({ancestorUri: vscode.Uri.file(parentPath), childUri: vscode.Uri.file(currentPath)});
		currentPath = parentPath;
	}

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
		const start = Date.now();
		await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
		const duration = Date.now() - start;

		if (2 === 2) {
			options.passed(item, duration);
		} else {
			const message = vscode.TestMessage.diff(`Expected ${item.label}`, String(6), String(2 + 3));
			options.failed(item, message, duration);
		}
	}
}
