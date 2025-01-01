import * as vscode from 'vscode';
import { getAncestors, getTestId, getTestLabel, globPatternForTestfiles, testData, TestDirectory, TestFile } from './testTree';

export async function activate(context: vscode.ExtensionContext) {
	const ctrl = vscode.tests.createTestController('brunoCliTestController', 'Bruno CLI Test');
	context.subscriptions.push(ctrl);

	const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
	const watchingTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();
	fileChangedEmitter.event(uri => {
		if (watchingTests.has('ALL')) {
			startTestRun(new vscode.TestRunRequest(undefined, undefined, watchingTests.get('ALL'), true));
			return;
		}

		const include: vscode.TestItem[] = [];
		let profile: vscode.TestRunProfile | undefined;
		for (const [item, thisProfile] of watchingTests) {
			const cast = item as vscode.TestItem;
			if (cast.uri?.toString() == uri.toString()) {
				include.push(cast);
				profile = thisProfile;
			}
		}

		if (include.length) {
			startTestRun(new vscode.TestRunRequest(include, undefined, profile, true));
		}
	});

	const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
		if (!request.continuous) {
			return startTestRun(request);
		}

		if (request.include === undefined) {
			watchingTests.set('ALL', request.profile);
			cancellation.onCancellationRequested(() => watchingTests.delete('ALL'));
		} else {
			request.include.forEach(item => watchingTests.set(item, request.profile));
			cancellation.onCancellationRequested(() => request.include!.forEach(item => watchingTests.delete(item)));
		}
	};

	const startTestRun = (request: vscode.TestRunRequest) => {
		const queue: { test: vscode.TestItem; data: TestFile }[] = [];
		const run = ctrl.createTestRun(request);

		const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
			for (const test of tests) {
				if (request.exclude?.includes(test)) {
					continue;
				}

				const data = testData.get(test);
				if (data instanceof TestFile) {
					if (!data.didResolve) {
						await data.updateFromDisk(ctrl, test);
					}
					run.enqueued(test);
					queue.push({ test, data });
				}

				await discoverTests(gatherTestItems(test.children));
			}
		};

		const runTestQueue = async () => {
			for (const { test, data } of queue) {
				run.appendOutput(`Running ${test.id}\r\n`);
				if (run.token.isCancellationRequested) {
					run.skipped(test);
				} else {
					run.started(test);
					await data.run(test, run);
				}

				run.appendOutput(`Completed ${test.id}\r\n`);
			}

			run.end();
		};

		discoverTests(request.include ?? gatherTestItems(ctrl.items)).then(runTestQueue);
	};

	ctrl.refreshHandler = async () => {
		await Promise.all(getWorkspaceTestPatterns().map((pattern) => findInitialFilesAndDirectories(ctrl, pattern)));
	};

	ctrl.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true, undefined, true);

	ctrl.resolveHandler = async item => {
		if (!item) {
			context.subscriptions.push(...startWatchingWorkspace(ctrl, fileChangedEmitter));
			return;
		}

		const data = testData.get(item);
		if (data instanceof TestFile) {
			await data.updateFromDisk(ctrl, item);
		}
	};

	function updateNodeForDocument(e: vscode.TextDocument) {
		if (e.uri.scheme !== 'file') {
			return;
		}

		if (!e.uri.path.endsWith('.bru')) {
			return;
		}

		const { testItem, testFile } = getOrCreateFile(ctrl, e.uri);
		testFile.updateFromContents(ctrl, testItem);
	}

	for (const document of vscode.workspace.textDocuments) {
		updateNodeForDocument(document);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateNodeForDocument),
		vscode.workspace.onDidChangeTextDocument(e => updateNodeForDocument(e.document)),
	);
}

function getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri) {
	const existing = controller.items.get(getTestId(uri));
	if (existing) {
		return { testItem: existing, testFile: testData.get(existing) as TestFile };
	}

	const testItem = controller.createTestItem(getTestId(uri), getTestLabel(uri), uri);
	controller.items.add(testItem);

	const testFile = new TestFile(testItem.uri?.fsPath!);
	testData.set(testItem, testFile);

	testItem.canResolveChildren = false;
	return { testItem, testFile };
}

function getOrCreateAncestorDirectoriesForFile(controller: vscode.TestController, testFileUri: vscode.Uri) {
	const addChildItemForAncestor = (ancestorTestItem: vscode.TestItem, childUri: vscode.Uri) => {
		if (!controller.items.get(getTestId(childUri))) {
			console.log(`Did not find child URI '${childUri}' in existing items. Will create new item and add it to controller.`)
		}
		const childItem = controller.items.get(getTestId(childUri)) ?? controller.createTestItem(getTestId(childUri), getTestLabel(childUri), childUri);
		ancestorTestItem.children.add(childItem);
	}

	const ancestors = getAncestors(new TestFile(testFileUri.fsPath));
	const result: {testItem: vscode.TestItem, testDirectory: TestDirectory}[] = [];

	ancestors.forEach((ancestor) => {
		// ToDo: Remove logging after fixing issue with missing testcases when using all ancestors
		console.log("------------------------------------------------")
		console.log(`current testFileUri URI: '${testFileUri}'`);
		console.log(`current ancestor URI: '${ancestor.ancestorUri}'`);
		console.log(`current child URI: '${ancestor.childUri}'`);
		console.log(`current controller items size: ${controller.items.size}`);
		controller.items.forEach((item) => console.log(`found controller item: '${item.uri}'`));

		const existing = controller.items.get(getTestId(ancestor.ancestorUri));
		if (existing) {
			addChildItemForAncestor(existing, ancestor.childUri);
			result.push({ testItem: existing, testDirectory: testData.get(existing) as TestDirectory });
		} else {
			const ancestorTestItem = controller.createTestItem(getTestId(ancestor.ancestorUri), getTestLabel(ancestor.ancestorUri), ancestor.ancestorUri);
			controller.items.add(ancestorTestItem);

			addChildItemForAncestor(ancestorTestItem, ancestor.childUri);
		
			const testDirectory = new TestDirectory(ancestorTestItem.uri?.fsPath!);
			testData.set(ancestorTestItem, testDirectory);
			ancestorTestItem.canResolveChildren = true;
	
			result.push({testItem: ancestorTestItem, testDirectory});
		}
	})
	
	return result;
}

function gatherTestItems(collection: vscode.TestItemCollection) {
	const items: vscode.TestItem[] = [];
	collection.forEach(item => items.push(item));
	return items;
}

function getWorkspaceTestPatterns() {
	if (!vscode.workspace.workspaceFolders) {
		return [];
	}

	return vscode.workspace.workspaceFolders.map(workspaceFolder => new vscode.RelativePattern(workspaceFolder, globPatternForTestfiles));
}

async function findInitialFilesAndDirectories(controller: vscode.TestController, pattern: vscode.GlobPattern) {
	const relevantFiles = await vscode.workspace.findFiles(pattern);
	// ToDo: Remove logging after fixing issue with missing testcases when using all ancestors
	console.clear();
	for (const file of relevantFiles) {
		getOrCreateFile(controller, file);
		getOrCreateAncestorDirectoriesForFile(controller, file);
	}
}

function startWatchingWorkspace(controller: vscode.TestController, fileChangedEmitter: vscode.EventEmitter<vscode.Uri>) {
	return getWorkspaceTestPatterns().map((pattern) => {
		const watcher = vscode.workspace.createFileSystemWatcher(pattern);

		watcher.onDidCreate(uri => {
			getOrCreateFile(controller, uri);
			getOrCreateAncestorDirectoriesForFile(controller, uri);
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidChange(async uri => {
			const { testItem, testFile } = getOrCreateFile(controller, uri);
			if (testFile.didResolve) {
				await testFile.updateFromDisk(controller, testItem);
			}
			fileChangedEmitter.fire(uri);
		});
		watcher.onDidDelete(uri => controller.items.delete(uri.toString()));

		findInitialFilesAndDirectories(controller, pattern);

		return watcher;
	});
}
