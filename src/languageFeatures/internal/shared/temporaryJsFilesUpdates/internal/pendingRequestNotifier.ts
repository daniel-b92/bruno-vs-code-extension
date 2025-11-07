import { EventEmitter, ProgressLocation, window } from "vscode";

export class PendingRequestNotifier {
    constructor() {
        this.isNotifierActive = false;
    }

    private isNotifierActive: boolean;
    private stopShowingNotificationNotifier = new EventEmitter<void>();

    public showPendingRequestInfo() {
        if (this.isNotifierActive) {
            return;
        }

        window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: "Language feature response is taking longer than usual...",
            },
            () => {
                this.isNotifierActive = true;

                return new Promise<void>((resolve) => {
                    this.stopShowingNotificationNotifier.event(() => {
                        this.isNotifierActive = false;
                        resolve();
                    });
                });
            },
        );
    }

    public stopShowingPendingRequestInfo() {
        if (!this.isNotifierActive) {
            return;
        }

        this.stopShowingNotificationNotifier.fire();
    }
}
