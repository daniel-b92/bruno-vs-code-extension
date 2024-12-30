import { TextDecoder } from 'util';
import * as vscode from 'vscode';

const textDecoder = new TextDecoder('utf-8');

export type BrunoTestData = TestFile;

export const testData = new WeakMap<vscode.TestItem, BrunoTestData>();

export class TestFile {
	public didResolve = false;

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
		const id = `${item.uri}`;

		const tcase = controller.createTestItem(id, id, item.uri);
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
