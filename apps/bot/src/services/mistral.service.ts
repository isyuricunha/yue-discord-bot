import { readFile } from "node:fs/promises";
import path from "node:path";

import { Mistral } from "@mistralai/mistralai";
import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

import { logger } from "../utils/logger";

type mistral_sdk_client = {
	chat: {
		complete: (request: unknown) => Promise<unknown>;
	};
	agents: {
		complete: (request: unknown) => Promise<unknown>;
	};
	beta?: {
		conversations?: {
			start: (request: unknown) => Promise<unknown>;
		};
	};
	files?: {
		download: (request: unknown) => Promise<ReadableStream<Uint8Array>>;
	};
};

type mistral_completion_response = {
	choices?: Array<{
		message?: {
			content?: unknown;
		};
	}>;
};

type mistral_key_state = {
	api_key: string;
	agent_id: string | null;
	cooldown_until_ms: number;
};

type mistral_role = "system" | "user" | "assistant";

type mistral_message = {
	role: mistral_role;
	content: string;
};

export type mistral_completion_input = {
	user_prompt: string;
	history?: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

export type mistral_completion_result = {
	content: string;
	attachments?: Array<{
		filename: string;
		content_type: string;
		data: Buffer;
	}>;
};

export class MistralApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body: unknown,
		public readonly retry_after_seconds: number | null
	) {
		super(message);
		this.name = "MistralApiError";
	}
}

function parse_retry_after_seconds(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return parsed;
}

function env_keys(): string[] {
	const primary = process.env.MISTRAL_API_KEY;
	const fallback_1 = process.env.MISTRAL_API_KEY_FALLBACK_1;
	const fallback_2 = process.env.MISTRAL_API_KEY_FALLBACK_2;

	const primary_trimmed = typeof primary === "string" ? primary.trim() : "";
	if (!primary_trimmed) return [];

	return [primary_trimmed, fallback_1, fallback_2].filter(
		(v): v is string => typeof v === "string" && v.trim().length > 0
	);
}

function env_agent_id_by_index(index: number): string | null {
	const raw =
		index === 0
			? process.env.MISTRAL_AGENT_ID
			: index === 1
				? process.env.MISTRAL_AGENT_ID_FALLBACK_1
				: process.env.MISTRAL_AGENT_ID_FALLBACK_2;
	const trimmed = typeof raw === "string" ? raw.trim() : "";
	return trimmed ? trimmed : null;
}

function env_model(): string {
	const value = process.env.MISTRAL_MODEL;
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: "mistral-small-latest";
}

function env_temperature(): number {
	const value = process.env.MISTRAL_TEMPERATURE;
	if (!value) return 0.2;
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return 0.2;
	return parsed;
}

function env_max_tokens(): number {
	const value = process.env.MISTRAL_MAX_TOKENS;
	if (!value) return 512;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 4096) return 512;
	return parsed;
}

async function read_prompt_file(path: string): Promise<string> {
	const content = await readFile(path, "utf8");
	const trimmed = content.trim();
	return trimmed.length > 0 ? trimmed : default_system_prompt();
}

function default_system_prompt(): string {
	return (
		"You are Yue, a helpful Discord bot assistant.\n" +
		"Answer clearly and concisely.\n" +
		"If you are unsure, say so.\n" +
		"Avoid disallowed content and never request or reveal secrets.\n"
	);
}

async function load_mistral_system_prompt(): Promise<string> {
	const env_path = process.env.MISTRAL_PROMPT_PATH;
	const path =
		typeof env_path === "string" && env_path.trim().length > 0
			? env_path.trim()
			: null;
	if (!path) return default_system_prompt();

	try {
		return await read_prompt_file(path);
	} catch {
		return default_system_prompt();
	}
}

type mistral_client_deps = {
	system_prompt?: () => Promise<string>;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
	now_ms?: () => number;
	clients?: mistral_sdk_client[];
};

function extract_text_content(input: unknown): string {
	if (typeof input === "string") return input;

	if (Array.isArray(input)) {
		return input
			.map((chunk) => {
				if (!chunk || typeof chunk !== "object") return "";
				const record = chunk as Record<string, unknown>;
				if (record.type === "text" && typeof record.text === "string") {
					return record.text;
				}
				return "";
			})
			.join("");
	}

	return "";
}

type conversation_output_entry = {
	type?: string;
	content?: unknown;
};

type tool_reference_chunk = {
	type?: "tool_reference";
	tool?: string;
	title?: string;
	url?: string | null;
	description?: string | null;
};

type tool_file_chunk = {
	type?: "tool_file";
	tool?: string;
	fileId?: string;
	fileName?: string | null;
	fileType?: string | null;
};

type tool_execution_entry = {
	type?: "tool.execution";
	name?: string;
	arguments?: string;
	info?: unknown;
};

function is_tool_reference_chunk(
	chunk: unknown
): chunk is tool_reference_chunk {
	if (!chunk || typeof chunk !== "object") return false;
	const record = chunk as Record<string, unknown>;
	return record.type === "tool_reference";
}

function is_tool_file_chunk(chunk: unknown): chunk is tool_file_chunk {
	if (!chunk || typeof chunk !== "object") return false;
	const record = chunk as Record<string, unknown>;
	return record.type === "tool_file";
}

function is_tool_execution_entry(
	entry: unknown
): entry is tool_execution_entry {
	if (!entry || typeof entry !== "object") return false;
	const record = entry as Record<string, unknown>;
	return record.type === "tool.execution";
}

function truncate_single_line(input: string, max_len: number): string {
	const line = input.replace(/\s+/g, " ").trim();
	if (line.length <= max_len) return line;
	return `${line.slice(0, Math.max(0, max_len - 1))}…`;
}

function decode_html_entities(input: string): string {
	return input
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&#x27;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&nbsp;", " ");
}

function strip_html_tags(input: string): string {
	return input.replace(/<[^>]*>/g, "");
}

function sanitize_source_text(input: string | null): string {
	if (!input) return "";
	const decoded = decode_html_entities(input);
	const stripped = strip_html_tags(decoded);
	return stripped.replace(/\s+/g, " ").trim();
}

function normalize_url_for_discord(url: string): string {
	return url.trim();
}

function summarize_tool_executions(
	outputs: unknown
): Array<{ name: string; has_info: boolean; info_keys: string[] }> {
	if (!Array.isArray(outputs)) return [];

	const entries = outputs.filter(is_tool_execution_entry);
	return entries
		.map((e) => {
			const name = typeof e.name === "string" ? e.name : "";
			const info = e.info;
			const info_keys =
				info && typeof info === "object"
					? Object.keys(info as Record<string, unknown>)
					: [];
			return {
				name: name || "unknown",
				has_info: info_keys.length > 0,
				info_keys: info_keys.slice(0, 10),
			};
		})
		.filter((e) => e.name !== "unknown" || e.has_info);
}

function build_search_results_suffix(
	outputs: unknown,
	response_text: string
): string {
	if (!Array.isArray(outputs)) return "";

	const executions = outputs.filter(is_tool_execution_entry).filter((e) => {
		const name = typeof e.name === "string" ? e.name : "";
		return name === "web_search" || name === "web_search_premium";
	});

	const results: Array<{ title: string; url: string; snippet: string }> = [];
	for (const exec of executions) {
		const info = exec.info;
		if (!info || typeof info !== "object") continue;
		const record = info as Record<string, unknown>;
		const raw_results = record.results;
		if (!Array.isArray(raw_results)) continue;

		for (const r of raw_results) {
			if (!r || typeof r !== "object") continue;
			const rr = r as Record<string, unknown>;
			const url = typeof rr.url === "string" ? rr.url.trim() : "";
			if (!url) continue;
			const title = typeof rr.title === "string" ? rr.title.trim() : url;
			const snippet =
				typeof rr.snippet === "string"
					? rr.snippet
					: typeof rr.description === "string"
						? rr.description
						: typeof rr.content === "string"
							? rr.content
							: "";
			results.push({ title, url, snippet });
		}
	}

	if (results.length === 0) return "";

	const unique_urls = new Set<string>();
	const lines: string[] = [];
	for (const r of results) {
		if (unique_urls.has(r.url)) continue;
		unique_urls.add(r.url);
		const snippet = r.snippet
			? `: ${truncate_single_line(r.snippet, 180)}`
			: "";
		lines.push(`- ${r.title}${snippet} (${r.url})`);
		if (lines.length >= 3) break;
	}

	if (lines.length === 0) return "";

	// Avoid duplicating if the assistant already included the urls.
	const already_mentions_any = [...unique_urls].some((u) =>
		response_text.includes(u)
	);
	if (already_mentions_any) return "";

	return `\n\nResultados da busca:\n${lines.join("\n")}`;
}

function detect_file_from_magic(
	data: Buffer
): { ext: string; content_type: string } | null {
	if (data.length >= 4) {
		const png_prefix = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		if (data.subarray(0, 4).equals(png_prefix)) {
			return { ext: "png", content_type: "image/png" };
		}
	}
	if (data.length >= 3) {
		if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
			return { ext: "jpg", content_type: "image/jpeg" };
		}
	}
	if (data.length >= 4) {
		const header = data.subarray(0, 4).toString("ascii");
		if (header === "GIF8") return { ext: "gif", content_type: "image/gif" };
		if (header === "%PDF")
			return { ext: "pdf", content_type: "application/pdf" };
		if (header === "RIFF" && data.length >= 12) {
			const tag = data.subarray(8, 12).toString("ascii");
			if (tag === "WEBP") return { ext: "webp", content_type: "image/webp" };
		}
	}

	return null;
}

function normalize_ext(input: string): string {
	const trimmed = input.trim().toLowerCase();
	const no_dot = trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
	return no_dot;
}

function infer_file_meta(input: {
	file_id: string;
	file_name: string | null;
	file_type: string | null;
	data: Buffer;
}): { filename: string; content_type: string } {
	const type = input.file_type ? normalize_ext(input.file_type) : "";
	const raw_name =
		typeof input.file_name === "string" ? input.file_name.trim() : "";
	const name = raw_name.length > 0 ? raw_name : `mistral_file_${input.file_id}`;
	const current_ext = normalize_ext(path.extname(name));

	const by_type = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		pdf: "application/pdf",
	} as const;

	const ext_from_type = type && Object.prototype.hasOwnProperty.call(by_type, type)
		? type
		: "";
	const ext_from_name =
		current_ext && current_ext.length > 0 ? current_ext : "";
	const magic = detect_file_from_magic(input.data);
	const ext = ext_from_type || ext_from_name || magic?.ext || "bin";
	const content_type_from_ext = Object.prototype.hasOwnProperty.call(
		by_type,
		ext
	)
		? by_type[ext as keyof typeof by_type]
		: null;
	const content_type = content_type_from_ext ?? magic?.content_type ?? "application/octet-stream";

	const final_name = ext_from_name ? name : `${name}.${ext}`;
	return { filename: final_name, content_type };
}

function build_sources_suffix(chunks: unknown): string {
	if (!Array.isArray(chunks)) return "";

	const sources = chunks
		.filter(is_tool_reference_chunk)
		.map((c) => ({
			title: sanitize_source_text(c.title ?? null) || null,
			url:
				typeof c.url === "string" && c.url.trim().length > 0
					? normalize_url_for_discord(c.url)
					: null,
			description: sanitize_source_text(c.description ?? null) || null,
		}))
		.filter((s) => typeof s.url === "string" && s.url.trim().length > 0);

	const unique_urls = new Set<string>();
	const lines: string[] = [];
	for (const s of sources) {
		const url = String(s.url);
		if (unique_urls.has(url)) continue;
		unique_urls.add(url);

		const title = s.title ? String(s.title) : "";
		const desc =
			typeof s.description === "string" && s.description.trim().length > 0
				? truncate_single_line(s.description, 140)
				: "";

		const header = title || desc ? `- ${title || desc}` : "-";
		const snippet_line =
			title && desc ? `  ${desc}` : title || !desc ? "" : `  ${desc}`;
		lines.push(header);
		if (snippet_line) lines.push(snippet_line);
		lines.push(`  <${url}>`);
	}

	if (lines.length === 0) return "";
	return `\n\nFontes:\n${lines.join("\n")}`;
}

function assistant_already_has_sources_section(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return /(^|\n)\s*(?:fontes|sources)\s*:/i.test(trimmed);
}

async function stream_to_buffer(
	stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
	const array_buffer = await new Response(stream).arrayBuffer();
	return Buffer.from(array_buffer);
}

export class MistralClient {
	private readonly keys: mistral_key_state[];
	private readonly clients: mistral_sdk_client[];
	private readonly system_prompt: () => Promise<string>;
	private readonly model: () => string;
	private readonly temperature: () => number;
	private readonly max_tokens: () => number;
	private readonly now_ms: () => number;

	constructor(
		input: {
			keys: Array<{ api_key: string; agent_id: string | null }>;
			clients: mistral_sdk_client[];
		},
		deps: mistral_client_deps = {}
	) {
		if (input.keys.length === 0) {
			throw new Error("MISTRAL_API_KEY is required to use Mistral features");
		}
		if (input.keys.length !== input.clients.length) {
			throw new Error(
				"Mistral client mismatch: keys and clients length differ"
			);
		}

		this.keys = input.keys.map((k) => ({
			api_key: k.api_key,
			agent_id: k.agent_id,
			cooldown_until_ms: 0,
		}));
		this.clients = input.clients;
		this.system_prompt = deps.system_prompt ?? load_mistral_system_prompt;
		this.model = deps.model ?? env_model;
		this.temperature = deps.temperature ?? env_temperature;
		this.max_tokens = deps.max_tokens ?? env_max_tokens;
		this.now_ms = deps.now_ms ?? (() => Date.now());
	}

	static from_env(deps: mistral_client_deps = {}): MistralClient {
		const keys = env_keys();
		const key_defs = keys.map((api_key, index) => ({
			api_key,
			agent_id: env_agent_id_by_index(index),
		}));

		const clients = (deps.clients ?? []).length
			? deps.clients
			: key_defs.map(
					(k) =>
						new Mistral({ apiKey: k.api_key }) as unknown as mistral_sdk_client
				);

		return new MistralClient({ keys: key_defs, clients }, deps);
	}

	private pick_key_index(): number | null {
		const now = this.now_ms();

		for (let i = 0; i < this.keys.length; i += 1) {
			if (this.keys[i]!.cooldown_until_ms <= now) return i;
		}

		return null;
	}

	private earliest_cooldown_seconds(): number | null {
		const now = this.now_ms();
		const next = this.keys
			.map((k) => k.cooldown_until_ms)
			.filter((v) => v > now)
			.sort((a, b) => a - b)[0];

		if (!next) return null;
		return Math.max(1, Math.ceil((next - now) / 1000));
	}

	private mark_cooldown(index: number, seconds: number): void {
		const now = this.now_ms();
		this.keys[index]!.cooldown_until_ms = Math.max(
			this.keys[index]!.cooldown_until_ms,
			now + seconds * 1000
		);
	}

	async create_completion(
		input: mistral_completion_input
	): Promise<mistral_completion_result> {
		const history: mistral_message[] = (input.history ?? [])
			.filter(
				(msg) =>
					typeof msg?.content === "string" && msg.content.trim().length > 0
			)
			.map((msg) => ({ role: msg.role, content: msg.content.trim() }));

		const attempted = new Set<number>();
		let last_error: unknown = null;

		while (attempted.size < this.keys.length) {
			const key_index = this.pick_key_index();
			if (key_index === null) {
				const wait = this.earliest_cooldown_seconds();
				throw new MistralApiError(
					"All Mistral API keys are rate limited",
					429,
					null,
					wait
				);
			}

			if (attempted.has(key_index)) {
				this.mark_cooldown(key_index, 1);
				continue;
			}

			attempted.add(key_index);
			const client = this.clients[key_index]!;
			const agent_id = this.keys[key_index]!.agent_id;

			const llm_debug_enabled = process.env.LLM_DEBUG === "1";

			try {
				const messages: mistral_message[] = agent_id
					? [...history, { role: "user", content: input.user_prompt }]
					: [
							{ role: "system", content: await this.system_prompt() },
							...history,
							{ role: "user", content: input.user_prompt },
						];

				if (llm_debug_enabled) {
					logger.debug(
						{
							llm: {
								provider: "mistral",
								mode: agent_id ? "agent" : "chat",
								model: agent_id ? null : this.model(),
							},
						},
						"LLM request dispatched"
					);
				}

				if (agent_id) {
					if (!client.beta?.conversations?.start) {
						throw new Error(
							"Mistral SDK missing beta.conversations.start; cannot run agent tools"
						);
					}
					if (!client.files?.download) {
						throw new Error(
							"Mistral SDK missing files.download; cannot retrieve tool-generated files"
						);
					}

					const entries = messages.map((m) => ({
						object: "entry",
						type: "message.input",
						role: m.role,
						content: m.content,
						prefix: false,
					}));

					const conversation = (await client.beta.conversations.start({
						agentId: agent_id,
						inputs: entries,
						store: false,
					})) as { outputs?: conversation_output_entry[] };

					const outputs = Array.isArray(conversation.outputs)
						? conversation.outputs
						: [];

					if (llm_debug_enabled) {
						const summary = summarize_tool_executions(outputs);
						if (summary.length > 0) {
							logger.debug(
								{ llm: { provider: "mistral", mode: "agent" }, tools: summary },
								"Mistral agent tool executions"
							);
						}
					}

					const last_output = [...outputs]
						.reverse()
						.find((o) => o && o.type === "message.output");

					const raw_content = last_output?.content;
					const content = extract_text_content(raw_content);
					const suffix = assistant_already_has_sources_section(content)
						? ""
						: build_sources_suffix(raw_content);
					const results_suffix = build_search_results_suffix(outputs, content);
					const merged = `${content}${results_suffix}${suffix}`;
					const trimmed = merged.trim();
					if (!trimmed) {
						throw new MistralApiError(
							"Mistral API returned empty response",
							502,
							conversation,
							null
						);
					}

					const chunks = Array.isArray(raw_content) ? raw_content : [];
					const file_chunks = chunks.filter(is_tool_file_chunk);
					const attachments: mistral_completion_result["attachments"] = [];

					for (const chunk of file_chunks) {
						const file_id =
							typeof chunk.fileId === "string" ? chunk.fileId : "";
						if (!file_id) continue;

						const stream = await client.files.download({ fileId: file_id });
						const data = await stream_to_buffer(stream);
						const meta = infer_file_meta({
							file_id,
							file_name:
								typeof chunk.fileName === "string" ? chunk.fileName : null,
							file_type:
								typeof chunk.fileType === "string" ? chunk.fileType : null,
							data,
						});
						attachments.push({
							filename: meta.filename,
							content_type: meta.content_type,
							data,
						});
					}

					return attachments && attachments.length > 0
						? { content: trimmed, attachments }
						: { content: trimmed };
				}

				const res = (await client.chat.complete({
					model: this.model(),
					messages,
					maxTokens: this.max_tokens(),
					temperature: this.temperature(),
					responseFormat: { type: "text" },
				})) as mistral_completion_response;

				const content = extract_text_content(
					res.choices?.[0]?.message?.content
				);
				const trimmed = typeof content === "string" ? content.trim() : "";
				if (!trimmed) {
					throw new MistralApiError(
						"Mistral API returned empty response",
						502,
						res,
						null
					);
				}

				return { content: trimmed };
			} catch (error: unknown) {
				last_error = error;

				const status = error instanceof MistralError ? error.statusCode : null;
				const retry_after_seconds =
					error instanceof MistralError
						? parse_retry_after_seconds(
								error.headers?.get("retry-after") ?? null
							)
						: null;

				const should_fallback =
					error instanceof MistralError
						? status === 401 ||
							status === 403 ||
							status === 429 ||
							status >= 500
						: true;

				if (error instanceof MistralError && status === 429) {
					this.mark_cooldown(key_index, retry_after_seconds ?? 10);
				} else if (should_fallback) {
					this.mark_cooldown(key_index, 1);
				}

				if (!should_fallback) throw error;
			}
		}

		const wait = this.earliest_cooldown_seconds();
		if (last_error instanceof MistralApiError && last_error.status === 429) {
			throw new MistralApiError(last_error.message, 429, last_error.body, wait);
		}
		if (last_error instanceof MistralError && last_error.statusCode === 429) {
			throw new MistralApiError(
				"All Mistral API keys are rate limited",
				429,
				null,
				wait
			);
		}

		if (last_error) throw last_error;
		throw new Error("Failed to get Mistral completion");
	}
}

export function create_mistral_client_for_tests(input: {
	keys: Array<{ api_key: string; agent_id: string | null }>;
	clients: mistral_sdk_client[];
	system_prompt?: () => Promise<string>;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
	now_ms?: () => number;
}): MistralClient {
	return new MistralClient(
		{ keys: input.keys, clients: input.clients },
		{
			system_prompt: input.system_prompt,
			model: input.model,
			temperature: input.temperature,
			max_tokens: input.max_tokens,
			now_ms: input.now_ms,
		}
	);
}
