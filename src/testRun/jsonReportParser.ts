import { readFileSync } from "fs";

type JsonReportData = {
    results: {
        test: {
            filename: string;
        };
        request: any;
        response: any;
        testResults: { status: "pass" | "fail" }[];
    }[];
}[];

export const getTestFilesWithFailures = (jsonReportPath: string) => {
    const reportData = JSON.parse(
        readFileSync(jsonReportPath).toString()
    ) as JsonReportData;
    const resultsWithFailures = reportData[0].results.filter((result) =>
        result.testResults.some((testResult) => testResult.status == "fail")
    );

    return resultsWithFailures.map((res) => ({
        file: res.test.filename,
        testResults: JSON.stringify(res.testResults, null, 2),
        request: JSON.stringify(res.request, null, 2),
        response: JSON.stringify(res.response, null, 2),
    }));
};
