import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForRetrieverRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import type { DocumentInterface } from "../documents/document.js";
import { Runnable, type RunnableInterface } from "../runnables/base.js";
import { RunnableConfig, ensureConfig } from "../runnables/config.js";

/**
 * Base Retriever class. All indexes should extend this class.
 */
export interface BaseRetrieverInput {
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose?: boolean;
}

export interface BaseRetrieverInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> extends RunnableInterface<string, DocumentInterface<Metadata>[]> {
  getRelevantDocuments(
    query: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<DocumentInterface<Metadata>[]>;
}

/**
 * Abstract base class for a Document retrieval system. A retrieval system
 * is defined as something that can take string queries and return the
 * most 'relevant' Documents from some source.
 */
export abstract class BaseRetriever<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>
  >
  extends Runnable<string, DocumentInterface<Metadata>[]>
  implements BaseRetrieverInterface
{
  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  verbose?: boolean;

  constructor(fields?: BaseRetrieverInput) {
    super(fields);
    this.callbacks = fields?.callbacks;
    this.tags = fields?.tags ?? [];
    this.metadata = fields?.metadata ?? {};
    this.verbose = fields?.verbose ?? false;
  }

  /**
   * TODO: This should be an abstract method, but we'd like to avoid breaking
   * changes to people currently using subclassed custom retrievers.
   * Change it on next major release.
   */
  _getRelevantDocuments(
    _query: string,
    _callbacks?: CallbackManagerForRetrieverRun
  ): Promise<DocumentInterface<Metadata>[]> {
    throw new Error("Not implemented!");
  }

  async invoke(
    input: string,
    options?: RunnableConfig
  ): Promise<DocumentInterface<Metadata>[]> {
    return this.getRelevantDocuments(input, ensureConfig(options));
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   *
   * Main method used to retrieve relevant documents. It takes a query
   * string and an optional configuration object, and returns a promise that
   * resolves to an array of `Document` objects. This method handles the
   * retrieval process, including starting and ending callbacks, and error
   * handling.
   * @param query The query string to retrieve relevant documents for.
   * @param config Optional configuration object for the retrieval process.
   * @returns A promise that resolves to an array of `Document` objects.
   */
  async getRelevantDocuments(
    query: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<DocumentInterface<Metadata>[]> {
    const parsedConfig = ensureConfig(parseCallbackConfigArg(config));
    const callbackManager_ = await CallbackManager.configure(
      parsedConfig.callbacks,
      this.callbacks,
      parsedConfig.tags,
      this.tags,
      parsedConfig.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleRetrieverStart(
      this.toJSON(),
      query,
      parsedConfig.runId,
      undefined,
      undefined,
      undefined,
      parsedConfig.runName
    );
    try {
      const results = await this._getRelevantDocuments(query, runManager);
      await runManager?.handleRetrieverEnd(results);
      return results;
    } catch (error) {
      await runManager?.handleRetrieverError(error);
      throw error;
    }
  }
}
