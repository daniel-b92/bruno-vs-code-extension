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

    public removeItemsFromQueue(queuedTests: QueuedTest[]) {
        const oldestItemBeforeRemoval = this.getOldestItemFromQueue();

        for (const toBeRemoved of queuedTests) {
            const indexForRemoval = this.queue.findIndex(
                (val) => val.id == toBeRemoved.id
            );

            if (indexForRemoval >= 0) {
                this.queue.splice(indexForRemoval, 1);

                if (indexForRemoval == 0) {
                    // If the oldest item is removed, no run is active anymore
                    this.activeRun = undefined;
                }
            } else {
                console.warn(
                    `Item with ID '${toBeRemoved.id}' to be removed from TestRun queue not found in queue.`
                );
            }
        }

        if (
            this.queue.length > 0 &&
            oldestItemBeforeRemoval &&
            !this.queue.some(
                (queued) => queued.id == oldestItemBeforeRemoval.id
            )
        ) {
            // If the oldest item in the queue is a different item than before we can start running this test
            const nextTestToRun = this.getOldestItemFromQueue() as QueuedTest;
            this.activeRun = this.controller.createTestRun(
                nextTestToRun.request
            );

            for (const enqueued of this.queue.slice(1)) {
                this.activeRun.enqueued(enqueued.test);
            }

            this.canStartRunningEmitter.fire({
                queuedTest: nextTestToRun,
                run: this.activeRun,
            });
        }
    }

    private getOldestItemFromQueue() {
        return this.queue.length > 0 ? this.queue[0] : undefined;
    }
}
