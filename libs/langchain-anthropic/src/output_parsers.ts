import { z } from "zod";
import {
  BaseLLMOutputParser,
  OutputParserException,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParserParams } from "@langchain/core/output_parsers/openai_tools";
import { ChatGeneration } from "@langchain/core/outputs";
import { ToolCall } from "@langchain/core/messages/tool";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AnthropicToolsOutputParserParams<T extends Record<string, any>>
  extends JsonOutputKeyToolsParserParams<T> {}

export class AnthropicToolsOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
> extends BaseLLMOutputParser<T> {
  static lc_name() {
    return "AnthropicToolsOutputParser";
  }

  lc_namespace = ["langchain", "anthropic", "output_parsers"];

  returnId = false;

  /** The type of tool calls to return. */
  keyName: string;

  /** Whether to return only the first tool call. */
  returnSingle = false;

  zodSchema?: z.ZodType<T>;

  constructor(params: AnthropicToolsOutputParserParams<T>) {
    super(params);
    this.keyName = params.keyName;
    this.returnSingle = params.returnSingle ?? this.returnSingle;
    this.zodSchema = params.zodSchema;
  }

  protected async _validateResult(result: unknown): Promise<T> {
    if (this.zodSchema === undefined) {
      return result as T;
    }
    const zodParsedResult = await this.zodSchema.safeParseAsync(result);
    if (zodParsedResult.success) {
      return zodParsedResult.data;
    } else {
      throw new OutputParserException(
        `Failed to parse. Text: "${JSON.stringify(
          result,
          null,
          2
        )}". Error: ${JSON.stringify(zodParsedResult.error.errors)}`,
        JSON.stringify(result, null, 2)
      );
    }
  }

  async parseResult(generations: ChatGeneration[]): Promise<T> {
    const tools = generations.flatMap((generation) => {
      const { message } = generation;
      if (!Array.isArray(message.content)) {
        return [];
      }
      const tool = extractToolCalls(message.content)[0];
      return tool;
    });
    if (tools[0] === undefined) {
      throw new Error(
        "No parseable tool calls provided to AnthropicToolsOutputParser."
      );
    }
    const [tool] = tools;
    const validatedResult = await this._validateResult(tool.args);
    return validatedResult;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractToolCalls(content: Record<string, any>[]) {
  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (block.type === "tool_use") {
      toolCalls.push({ name: block.name, args: block.input, id: block.id });
    }
  }
  return toolCalls;
}
