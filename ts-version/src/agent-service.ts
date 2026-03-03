import { Command, MemorySaver } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { browserTools } from "./browser-tools";
import { ConfirmationDialog } from "./confirmation-dialog";
import { showKoffiPopup } from "./hitl-bridge";

const MAX_ITERATIONS = 10;

export interface AgentConfig {
	ollamaUrl: string;
	model: string;
	showConfirmation: boolean;
	confirmationTimeoutSeconds: number;
}

export class AgentService {
	private agent: ReturnType<typeof createAgent>;
	private config: AgentConfig;
	private confirmationDialog = new ConfirmationDialog();

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
		let toolWasExecuted = false;
		let iterations = 0;

		let response = await this.agent.invoke(
			{ messages: [{ role: "user", content: userInput }] },
			config,
		);

		while (response.__interrupt__ && iterations < MAX_ITERATIONS) {
			iterations++;
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

			if (decision === "reject") {
				break;
			}
			if (decision === "approve") {
				toolWasExecuted = true;
			}

			response = await this.agent.invoke(
				new Command({
					resume: {
						[interrupt.id]: { decisions: [{ type: decision }] },
					},
				}),
				config,
			);
		}

		const finalResponse = response.messages.at(-1)?.content ?? null;

		if (toolWasExecuted && finalResponse) {
			this.confirmationDialog.showResponse(finalResponse);
		}

		return finalResponse;
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
