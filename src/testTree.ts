import * as vscode from 'vscode';

export type BrunoTestData = TestDirectory | TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

export const getChildItemsFromFilesystem = async (directoryItem: vscode.TestItem) => {
	try {
		const files = await vscode.workspace.fs.readDirectory(directoryItem.uri!);
		return files.filter((file) => file[1] == vscode.FileType.File && file[0].endsWith(".bru"))
				.map((file) => new TestFile(file[0]));
	} catch (e) {
		console.warn(`Error providing tests for directory ${directoryItem.uri!.fsPath}`, e);
		return [];
	}
};

export const getTestId = (testElementUri: vscode.Uri) => testElementUri.toString();

export const getTestLabel = (testElementUri: vscode.Uri) => testElementUri.path.split('/').pop()!;

export class TestDirectory {
	constructor(public path: string, public childItems: BrunoTestData[]) { }
	public didResolve = false;

	public async updateFromDisk(controller: vscode.TestController, directoryItem: vscode.TestItem) {
		try {
			const testFiles = await getChildItemsFromFilesystem(directoryItem);
			directoryItem.error = undefined;
			this.childItems = testFiles;
			this.updateFromContents(controller, directoryItem, testFiles);
		} catch (e) {
			directoryItem.error = (e as Error).stack;
		}
	}

	public updateFromContents(controller: vscode.TestController, item: vscode.TestItem, testFiles: TestFile[]) {
		this.didResolve = true;

		const testDirectory = controller.createTestItem(getTestId(item.uri!), getTestLabel(item.uri!), item.uri);

		testFiles.forEach((testFile) => {
			const testFileItem = controller.items.get(testFile.getTestId())!;

			testFile.updateFromDisk(controller, testFileItem);
			testFile.updateFromContents(controller, testFileItem);

			testDirectory.children.add(testFileItem);
		});

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
