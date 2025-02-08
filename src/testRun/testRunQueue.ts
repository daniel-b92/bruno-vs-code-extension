import { BrunoTestData } from "../testTreeHelper";
import {
    EventEmitter,
    TestController,
    TestRun,
    TestRunRequest,
    TestItem as vscodeTestItem,
} from "vscode";

export type QueuedTest = {
    request: TestRunRequest;
    test: vscodeTestItem;
    data: BrunoTestData;
    id: string;
    abortEmitter: EventEmitter<void>;
};

export class TestRunQueue {
    constructor(private controller: TestController) {
        this.canStartRunningEmitter = new EventEmitter<{
            queuedTest: QueuedTest;
            run: TestRun;
        }>();
        this.queue = [];
    }

    private canStartRunningEmitter: EventEmitter<{
        queuedTest: QueuedTest;
        run: TestRun;
    }>;

    private queue: QueuedTest[];

    public getRunStartableEmitter() {
        return this.canStartRunningEmitter;
    }

    public addToQueue(queuedTest: QueuedTest) {
        this.queue.push(queuedTest);
        if (this.queue.length == 1) {
            this.canStartRunningEmitter.fire({
                queuedTest,
                run: this.controller.createTestRun(queuedTest.request),
            });
        }
    }

    public removeItemFromQueue(queuedTest: QueuedTest) {
        const index = this.queue.findIndex((val) => val.id == queuedTest.id);
        this.queue.splice(index, 1);

        if (this.queue.length > 0) {
            this.canStartRunningEmitter.fire({
                queuedTest: this.getOldestItemFromQueue()!,
                run: this.controller.createTestRun( queuedTest.request),
            });
        }
    }

    private getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }
}
