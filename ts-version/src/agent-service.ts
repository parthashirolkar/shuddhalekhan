import { Command, MemorySaver } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { browserTools } from "./browser-tools";
import type { Config } from "./config";
import { showKoffiPopup } from "./hitl-bridge";

export interface AgentConfig {
	ollamaUrl: string;
	model: string;
	showConfirmation: boolean;
	confirmationTimeoutSeconds: number;
}

export class AgentService {
	private agent: ReturnType<typeof createAgent>;
	private config: AgentConfig;

	constructor(config: AgentConfig) {
		this.config = config;

		const model = new ChatOllama({
			baseUrl: config.ollamaUrl,
			model: config.model,
		});

		this.agent = createAgent({
			model,
			tools: browserTools,
			middleware: config.showConfirmation
				? [
						humanInTheLoopMiddleware({
							interruptOn: {
								open_url: true,
								search_web: true,
								open_browser: true,
							},
						}),
					]
				: [],
			checkpointer: new MemorySaver(),
		});
	}

	async run(userInput: string): Promise<string | null> {
		const config = { configurable: { thread_id: "fire-and-forget" } };

		let response = await this.agent.invoke(
			{ messages: [{ role: "user", content: userInput }] },
			config,
		);

		while (response.__interrupt__) {
			const interrupt = response.__interrupt__[0];
			const toolRequest = interrupt.value.actionRequests[0];

			const decision = await showKoffiPopup(
				{
					name: toolRequest.name,
					args: toolRequest.args,
					description: toolRequest.description,
				},
				this.config.confirmationTimeoutSeconds,
			);

			response = await this.agent.invoke(
				new Command({
					resume: {
						[interrupt.id]: { decisions: [{ type: decision }] },
					},
				}),
				config,
			);
		}

		return response.messages.at(-1)?.content ?? null;
	}

	async checkConnection(): Promise<boolean> {
		const model = new ChatOllama({
			baseUrl: this.config.ollamaUrl,
			model: this.config.model,
		});

		try {
			await model.invoke("test");
			return true;
		} catch {
			return false;
		}
	}
}
