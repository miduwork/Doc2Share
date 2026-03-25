/**
 * Behavioral Tracker: Theo dõi tốc độ lật trang và các hành vi tương tác.
 * Gửi tín hiệu về server để phân tích rủi ro (Bản nháp cho Phase 4).
 */

export class BehavioralTracker {
    private lastActionAt = Date.now();
    private actionIntervals: number[] = [];
    private documentId: string;
    private deviceId: string;
    private reportedAnomalies = new Set<string>();

    constructor(documentId: string, deviceId: string) {
        this.documentId = documentId;
        this.deviceId = deviceId;
    }

    trackPageFlip() {
        const now = Date.now();
        const interval = now - this.lastActionAt;
        this.actionIntervals.push(interval);
        this.lastActionAt = now;

        // Nếu lật quá nhanh (ví dụ: < 1s liên tục)
        if (this.actionIntervals.length >= 5) {
            const recent = this.actionIntervals.slice(-5);
            const avg = recent.reduce((a, b) => a + b, 0) / 5;

            if (avg < 1500) { // < 1.5s mỗi trang là dấu hiệu bất thường cho đọc chậm
                this.reportSuspiciousBehavior("high_frequency_flipping", { avg_interval_ms: avg });
            }

            // Kiểm tra tính đều đặn (Standard Deviation thấp = bot)
            const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 5;
            const stdDev = Math.sqrt(variance);
            if (stdDev < 100) { // Độ lệch < 100ms trong 5 lần lật = quá đều đặn
                this.reportSuspiciousBehavior("robotic_regularity", { std_dev_ms: stdDev });
            }
        }
    }

    private async reportSuspiciousBehavior(type: string, metadata: any) {
        if (this.reportedAnomalies.has(type)) return; // Only report once per session per anomaly type
        this.reportedAnomalies.add(type);

        try {
            await fetch("/api/reader-observability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_type: "suspicious_behavior",
                    document_id: this.documentId,
                    device_id: this.deviceId,
                    metadata: {
                        anomaly_type: type,
                        ...metadata
                    }
                }),
                credentials: "same-origin"
            });
        } catch (e) {
            // Silently fail to not alert the attacker
        }
    }
}
