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
        this.activeRun = undefined;
    }

    private canStartRunningEmitter: EventEmitter<{
        queuedTest: QueuedTest;
        run: TestRun;
    }>;

    private queue: QueuedTest[];
    private activeRun: TestRun | undefined;

    public getNextTestThatCanStartRunning(queuedItemsToAwait: QueuedTest[]) {
        return new Promise<{ queuedTest: QueuedTest; run: TestRun }>(
            (resolve) => {
                this.canStartRunningEmitter.event((item) => {
                    for (const queuedItem of queuedItemsToAwait) {
                        if (item.queuedTest.id == queuedItem.id) {
                            resolve(item);
                        }
                    }
                });
            }
        );
    }

    public addToQueue(queuedTest: QueuedTest) {
        this.queue.push(queuedTest);

        if (this.queue.length > 1) {
            this.activeRun?.enqueued(queuedTest.test);
            return;
        }

        this.activeRun = this.controller.createTestRun(queuedTest.request);
        this.canStartRunningEmitter.fire({
            queuedTest,
            run: this.activeRun,
        });
    }

    public removeItemFromQueue(queuedTest: QueuedTest) {
        const index = this.queue.findIndex((val) => val.id == queuedTest.id);
        this.queue.splice(index, 1);

        if (this.getOldestItemFromQueue() != undefined) {
            this.activeRun = this.controller.createTestRun(queuedTest.request);

            for (const enqueued of this.queue.slice(1)) {
                this.activeRun.enqueued(enqueued.test);
            }

            this.canStartRunningEmitter.fire({
                queuedTest: this.getOldestItemFromQueue()!,
                run: this.activeRun,
            });
        }
    }

    private getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }
}
