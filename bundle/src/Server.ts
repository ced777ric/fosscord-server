process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

import http from "http";
import * as Api from "@fosscord/api";
import * as Gateway from "@fosscord/gateway";
import { CDNServer } from "@fosscord/cdn";
import express from "express";
import { green, bold, yellow } from "picocolors";
import { Config, initDatabase } from "@fosscord/util";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

const app = express();
const server = http.createServer();
const port = Number(process.env.PORT) || 3001;
const production = process.env.NODE_ENV == "development" ? false : true;
server.on("request", app);

//this is what has been added for the /stop API route
process.on('SIGTERM', () => {
	server.close(() => {
		console.log("Stop API has been successfully POSTed, SIGTERM sent")
	})
})
//this is what has been added for the /stop API route

async function main() {
	server.listen(port);
	await initDatabase();
	await Config.init();
	// only set endpointPublic, if not already set
	await Config.set({
		cdn: {
			endpointClient: process.env.CLIENT_CDN ? process.env.CLIENT_CDN : "${location.host}",
			endpointPrivate: process.env.PRIVATE_CDN ? process.env.PRIVATE_CDN :`http://localhost:${port}`,
		},
		gateway: {
			endpointClient:
				'${location.protocol === "https:" ? "wss://" : "ws://"}' + process.env.CLIENT_GATEWAY ? process.env.CLIENT_GATEWAY : `localhost:${port}`,
			endpointPrivate: process.env.PRIVATE_GATEWAY ? process.env.PRIVATE_GATEWAY : `ws://localhost:${port}`,
			endpointPublic: process.env.PUBLIC_GATEWAY ? process.env.PUBLIC_GATEWAY : `ws://localhost:${port}`,
		},
		// regions: {
		// 	default: "fosscord",
		// 	useDefaultAsOptimal: true,
		// 	available: [
		// 		{
		// 			id: "fosscord",
		// 			name: "Fosscord",
		// 			endpoint: "127.0.0.1:3001",
		// 			vip: false,
		// 			custom: false,
		// 			deprecated: false,
		// 		},
		// 	],
		// },
	} as any);

	//Sentry
	if (Config.get().sentry.enabled) {
		console.log(
			`[Bundle] ${yellow("You are using Sentry! This may slightly impact performance on large loads!")}`
		);
		Sentry.init({
			dsn: Config.get().sentry.endpoint,
			integrations: [
				new Sentry.Integrations.Http({ tracing: true }),
				new Tracing.Integrations.Express({ app }),
			],
			tracesSampleRate: Config.get().sentry.traceSampleRate,
			environment: Config.get().sentry.environment
		});

		app.use(Sentry.Handlers.requestHandler());
		app.use(Sentry.Handlers.tracingHandler());
	}

	switch (process.env.MODE) {
		case "CDN":
			console.log("[Bundle] Start mode: CDN");
			const cdn = new CDNServer({server, port, production, app});
			await Promise.all([cdn.start()]);
			break;
		case "API":
			console.log("[Bundle] Start mode: API");
			const api = new Api.FosscordServer({ server, port, production, app });
			await Promise.all([api.start()]);
			break;
		case "GATEWAY":
			console.log("[Bundle] Start mode: GATEWAY");
			const gateway = new Gateway.Server({ server, port, production });
			await Promise.all([gateway.start()]);
			break;
		default:
			console.log("[Bundle] Start mode: ALL");
			const cdn1 = new CDNServer({server, port, production, app});
			const api1 = new Api.FosscordServer({ server, port, production, app });
			const gateway1 = new Gateway.Server({ server, port, production });
			await Promise.all([api1.start(), cdn1.start(), gateway1.start()]);
			break;
	}

	if (Config.get().sentry.enabled) {
		app.use(Sentry.Handlers.errorHandler());
		app.use(function onError(err: any, req: any, res: any, next: any) {
			res.statusCode = 500;
			res.end(res.sentry + "\n");
		});
	}
	console.log(`[Server] ${green(`listening on port ${bold(port)}`)}`);
}

main().catch(console.error);
