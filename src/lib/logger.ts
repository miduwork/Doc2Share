import "server-only";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, any>;
    env: string;
    version: string;
}

/**
 * Structured JSON logger for production readiness.
 * Logs to stdout/stderr in a format easily parsed by ELK/Datadog/CloudWatch.
 */
class Logger {
    private env = process.env.NODE_ENV || "development";
    private version = process.env.npm_package_version || "0.1.0";

    private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata,
            env: this.env,
            version: this.version,
        };

        const out = JSON.stringify(entry);

        if (level === "error") {
            console.error(out);
        } else if (level === "warn") {
            console.warn(out);
        } else {
            console.log(out);
        }
    }

    info(message: string, metadata?: Record<string, any>) {
        this.log("info", message, metadata);
    }

    warn(message: string, metadata?: Record<string, any>) {
        this.log("warn", message, metadata);
    }

    error(message: string, metadata?: Record<string, any>) {
        this.log("error", message, metadata);
    }

    debug(message: string, metadata?: Record<string, any>) {
        if (this.env !== "production") {
            this.log("debug", message, metadata);
        }
    }
}

export const logger = new Logger();
