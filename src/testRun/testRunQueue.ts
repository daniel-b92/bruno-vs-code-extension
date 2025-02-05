import { BrunoTestData } from "../testTreeHelper";
import { EventEmitter, TestRun, TestItem as vscodeTestItem } from "vscode";

export type QueuedTestRun = {
    test: vscodeTestItem;
    data: BrunoTestData;
    id: string;
    abortEmitter: EventEmitter<void>;
};

export class TestRunQueue {
    constructor() {
        this.canStartRunningEmitter = new EventEmitter<QueuedTestRun>;
        this.queue = [];
    }

    private canStartRunningEmitter: EventEmitter<QueuedTestRun>;

    private queue: QueuedTestRun[];

    public getRunStartableEmitter() {
        return this.canStartRunningEmitter;
    }

    public addToQueue(run: QueuedTestRun) {
        this.queue.push(run);
        if (this.queue.length == 1) {
            this.canStartRunningEmitter.fire(run);
        }
    }

    public removeItemFromQueue(queuedRun: QueuedTestRun) {
        const index = this.queue.findIndex((val) => val.id == queuedRun.id);
        this.queue.splice(index, 1);

        if (this.queue.length > 0) {
            this.canStartRunningEmitter.fire(this.getOldestItemFromQueue()!);
        }
    }

    public getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }

    public getNumberOfItemsInQueue() {
        return this.queue.length;
    }
}
