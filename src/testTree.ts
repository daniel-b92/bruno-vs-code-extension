import { TextDecoder } from 'util';
import * as vscode from 'vscode';

const textDecoder = new TextDecoder('utf-8');

export type BrunoTestData = TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

let generationCounter = 0;

export const getContentFromFile = async (uri: vscode.Uri) => {
	try {
		const rawContent = await vscode.workspace.fs.readFile(uri);
		return textDecoder.decode(rawContent);
	} catch (e) {
		console.warn(`Error providing tests for ${uri.fsPath}`, e);
		return '';
	}
};

export class TestFile {
	public didResolve = false;

	public async updateFromDisk(controller: vscode.TestController, item: vscode.TestItem) {
		try {
			const content = await getContentFromFile(item.uri!);
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
		const ancestors = [{ item, children: [] as vscode.TestItem[] }];
		this.didResolve = true;

		const ascend = (depth: number) => {
			while (ancestors.length > depth) {
				const finished = ancestors.pop()!;
				finished.item.children.replace(finished.children);
			}
		};

		const parent = ancestors[ancestors.length - 1];
		const id = `${item.uri}`;


		const tcase = controller.createTestItem(id, id, item.uri);
		parent.children.push(tcase);

		ascend(0); // finish and assign children for all remaining items
	}

	async run(item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
		const start = Date.now();
		await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
		const actual = 2;
		const duration = Date.now() - start;

		if (actual === 2) {
			options.passed(item, duration);
		} else {
			const message = vscode.TestMessage.diff(`Expected ${item.label}`, String(2), String(actual));
			message.location = new vscode.Location(item.uri!, item.range!);
			options.failed(item, message, duration);
		}
	}
}
