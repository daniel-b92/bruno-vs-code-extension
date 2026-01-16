import { existsSync, lstatSync } from "fs";
import { TestMessage, TestRun, TestItem as vscodeTestItem } from "vscode";
import { getTestItemDescendants } from "../../testTreeUtils/getTestItemDescendants";
import { getTestFilesWithFailures } from "../jsonReportParser";
import { getTestMessageForFailedTest } from "./getTestMessageForFailedTest";

export function setStatusForDescendantItems(
    testDirectoryItem: vscodeTestItem,
    jsonReportPath: string,
    options: TestRun,
    lineBreakForRunOutput: string,
) {
    if (!existsSync(jsonReportPath)) {
        options.appendOutput(
            `Could not find JSON report file.${lineBreakForRunOutput}`,
        );
        options.appendOutput(
            `Therefore cannot determine status of descendant test items. Will set status 'skipped' for all.${lineBreakForRunOutput}`,
        );
        getTestItemDescendants(testDirectoryItem).forEach((child) => {
            child.busy = false;
            options.skipped(child);
        });
        return;
    }

    const testFileDescendants = getTestItemDescendants(
        testDirectoryItem,
    ).filter((descendant) => lstatSync(descendant.uri!.fsPath).isFile());

    const failedTests = getTestFilesWithFailures(jsonReportPath)
        .map((failedTest) => ({
            // 'testfile' field from the JSON report does not always match the absolute file path
            item: testFileDescendants.find((descendant) =>
                descendant.uri!.fsPath.includes(failedTest.file),
            ),
            request: failedTest.request,
            response: failedTest.response,
            testResults: failedTest.testResults,
            assertionResults: failedTest.assertionResults,
            error: failedTest.error,
        }))
        .filter((failed) => failed.item != undefined) as {
        item: vscodeTestItem;
        request: Record<string, string | object>;
        response: Record<string, string | number | object>;
        testResults: Record<string, string>[];
        assertionResults: Record<string, string>[];
        error?: string;
    }[];

    getTestItemDescendants(testDirectoryItem).forEach((child) => {
        if (!child.uri) {
            throw new Error(
                `Child directory item to run does not have a URI! Item: ${JSON.stringify(
                    child,
                    null,
                    2,
                )}`,
            );
        }
        const childPath = child.uri.fsPath!;
        child.busy = false;

        const maybeTestFailure = failedTests.find((failed) =>
            failed.item.uri?.fsPath.includes(childPath),
        );

        if (!maybeTestFailure) {
            options.passed(child);
        } else if (maybeTestFailure && lstatSync(child.uri!.fsPath).isFile()) {
            // Only log details on failure for failed test file
            options.failed(
                child,
                getTestMessageForFailedTest(
                    {
                        ...maybeTestFailure,
                    },
                    lineBreakForRunOutput,
                ),
            );
        } else {
            // For ancestor test directories only log generic message
            options.failed(
                child,
                new TestMessage("A test in the directory failed."),
            );
        }
    });
}
