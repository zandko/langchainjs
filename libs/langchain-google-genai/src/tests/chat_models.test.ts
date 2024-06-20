import { test } from "@jest/globals";
import type { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "../chat_models.js";
import { removeAdditionalProperties } from "../utils/zod_to_genai_parameters.js";
import {
  convertBaseMessagesToContent,
  convertMessageContentToParts,
} from "../utils/common.js";

test("Google AI - `temperature` must be in range [0.0,1.0]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: -1.0,
      })
  ).toThrow();
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: 1.1,
      })
  ).toThrow();
});

test("Google AI - `maxOutputTokens` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        maxOutputTokens: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be in the range [0,1]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: 3,
      })
  ).toThrow();
});

test("Google AI - `topK` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topK: -1,
      })
  ).toThrow();
});

test("Google AI - `safetySettings` category array must be unique", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_MEDIUM_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_LOW_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_DEROGATORY" as HarmCategory,
            threshold: "BLOCK_ONLY_HIGH" as HarmBlockThreshold,
          },
        ],
      })
  ).toThrow();
});

test("removeAdditionalProperties can remove all instances of additionalProperties", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractKeys(obj: Record<string, any>, keys: string[] = []) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        keys.push(key);
        if (typeof obj[key] === "object" && obj[key] !== null) {
          extractKeys(obj[key], keys);
        }
      }
    }
    return keys;
  }

  const idealResponseSchema = z.object({
    idealResponse: z
      .string()
      .optional()
      .describe("The ideal response to the question"),
  });
  const questionSchema = z.object({
    question: z.string().describe("Question text"),
    type: z.enum(["singleChoice", "multiChoice"]).describe("Question type"),
    options: z.array(z.string()).describe("List of possible answers"),
    correctAnswer: z
      .string()
      .optional()
      .describe("correct answer from the possible answers"),
    idealResponses: z
      .array(idealResponseSchema)
      .describe("Array of ideal responses to the question"),
  });

  const schema = z.object({
    questions: z.array(questionSchema).describe("Array of question objects"),
  });

  const parsedSchemaArr = removeAdditionalProperties(zodToJsonSchema(schema));
  const arrSchemaKeys = extractKeys(parsedSchemaArr);
  expect(
    arrSchemaKeys.find((key) => key === "additionalProperties")
  ).toBeUndefined();
  const parsedSchemaObj = removeAdditionalProperties(
    zodToJsonSchema(questionSchema)
  );
  const arrSchemaObj = extractKeys(parsedSchemaObj);
  expect(
    arrSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();
});

test("convertMessageContentToParts correctly handles message types", () => {
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_current_weather",
          args: {
            location: "New York",
          },
          id: "123",
        },
      ],
    }),
    new ToolMessage(
      "{ weather: '28 °C', location: 'New York, NY' }",
      "get_current_weather",
      "123"
    ),
  ];
  const messagesAsGoogleParts = messages
    .map((msg) => convertMessageContentToParts(msg, false))
    .flat();
  console.log(messagesAsGoogleParts);
  expect(messagesAsGoogleParts).toEqual([
    { text: "You are a helpful assistant" },
    { text: "What's the weather like in new york?" },
    {
      functionCall: {
        name: "get_current_weather",
        args: {
          location: "New York",
        },
      },
    },
    { text: "{ weather: '28 °C', location: 'New York, NY' }" },
  ]);
});

test("convertBaseMessagesToContent correctly creates properly formatted content", async () => {
  const toolResponse = "{ weather: '28 °C', location: 'New York, NY' }";
  const toolName = "get_current_weather";
  const toolId = "123";
  const toolArgs = {
    location: "New York",
  };
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: toolName,
          args: toolArgs,
          id: toolId,
        },
      ],
    }),
    new ToolMessage(toolResponse, toolName, toolId),
  ];

  const messagesAsGoogleContent = convertBaseMessagesToContent(messages, false);
  console.log(messagesAsGoogleContent);
  // Google Generative AI API only allows for 'model' and 'user' roles
  // This means that 'system', 'human' and 'tool' messages are converted
  // to 'user' messages, and ai messages are converted to 'model' messages.
  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [
        { text: "You are a helpful assistant" },
        { text: "What's the weather like in new york?" },
      ],
    },
    {
      role: "model",
      parts: [
        {
          functionCall: {
            name: toolName,
            args: toolArgs,
          },
        },
      ],
    },
    {
      role: "user",
      parts: [{ text: toolResponse }],
    },
  ]);
});
