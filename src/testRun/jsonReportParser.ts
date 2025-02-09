import { readFileSync } from "fs";

type JsonReportData = {
    results: {
        test: {
            filename: string;
        };
        request: any;
        response: any;
        error?: string;
        testResults: { status: "pass" | "fail" }[];
    }[];
}[];

export const getTestFilesWithFailures = (jsonReportPath: string) => {
    const reportData = JSON.parse(
        readFileSync(jsonReportPath).toString()
    ) as JsonReportData;
    const resultsWithFailures = reportData[0].results.filter(
        (result) =>
            result.testResults.some(
                (testResult) => testResult.status == "fail"
            ) || result.error != undefined
    );

    return resultsWithFailures.map((res) => ({
        file: res.test.filename,
        testResults: res.testResults,
        error: res.error,
        request: res.request,
        response: res.response,
    }));
};
