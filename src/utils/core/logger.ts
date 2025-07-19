export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export class Logger {
	private static instance: Logger;
	private logLevel: LogLevel = LogLevel.INFO;

	private constructor() {}

	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	debug(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.DEBUG) {
			console.log(`🔍 ${message}`, ...args);
		}
	}
	normal(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`${message}`, ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`ℹ️  ${message}`, ...args);
		}
	}

	success(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`✅ ${message}`, ...args);
		}
	}

	warn(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.WARN) {
			console.warn(`⚠️  ${message}`, ...args);
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.ERROR) {
			console.error(`❌ ${message}`, ...args);
		}
	}

	step(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`🔧 ${message}`, ...args);
		}
	}

	progress(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`⏳ ${message}`, ...args);
		}
	}

	package(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`📦 ${message}`, ...args);
		}
	}

	config(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`📝 ${message}`, ...args);
		}
	}

	art(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`🎨 ${message}`, ...args);
		}
	}

	link(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`🔗 ${message}`, ...args);
		}
	}

	rocket(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`🚀 ${message}`, ...args);
		}
	}

	party(message: string, ...args: any[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.log(`🎉 ${message}`, ...args);
		}
	}
}

export const logger = Logger.getInstance();