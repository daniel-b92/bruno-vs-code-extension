import { BrunoTestData } from "../testTreeHelper";
import { EventEmitter, TestRun, TestItem as vscodeTestItem } from "vscode";

export type QueuedTestRun = {
    testRun: TestRun;
    test: vscodeTestItem;
    data: BrunoTestData;
    id: string
};

export class TestRunQueue {
    constructor(private oldestItemChangedEmitter: EventEmitter<QueuedTestRun>) {
        this.queue = [];
    }

    private queue: QueuedTestRun[];

    public addToQueue(run: QueuedTestRun) {
        this.queue.push(run);
    }

    public removeItemFromQueue(queuedRun: QueuedTestRun) {
        const index = this.queue.findIndex(
            (val) =>
                val.data.path == queuedRun.data.path &&
                JSON.stringify(val.testRun) == JSON.stringify(queuedRun.testRun)
        );
        this.queue.splice(index, 1);
        if (this.queue.length > 0) {
            this.oldestItemChangedEmitter.fire(this.getOldestItemFromQueue()!);
        }
    }

    public getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }

    public getNumberOfItemsInQueue() {
        return this.queue.length;
    }
}
