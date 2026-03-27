import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { type PretrainedOptions } from "@huggingface/transformers";
import { ChatOpenAI } from "@langchain/openai";
import { CONFIG } from "./config.ts";
import { DocumentProcessor } from "./documentProcessor.ts";
import { AI } from "./ai.ts";

type DebugLog = (...args: unknown[]) => void;

type RagAppParams = {
  debugLog?: DebugLog;
};

export class RagApp {
  private readonly debugLog: DebugLog;
  private vectorStore: Neo4jVectorStore | null = null;
  private ai: AI | null = null;
  private indexedDocuments = 0;

  constructor({ debugLog = console.log }: RagAppParams = {}) {
    this.debugLog = debugLog;
  }

  async initialize() {
    this.debugLog("Inicializando sistema de Embeddings com Neo4j...");

    const documentProcessor = new DocumentProcessor(
      CONFIG.pdf.path,
      CONFIG.textSplitter,
    );
    const documents = await documentProcessor.loadAndSplit();

    const embeddings = new HuggingFaceTransformersEmbeddings({
      model: CONFIG.embedding.modelName,
      pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions,
    });

    const nlpModel = new ChatOpenAI({
      temperature: CONFIG.openRouter.temperature,
      maxRetries: CONFIG.openRouter.maxRetries,
      modelName: CONFIG.openRouter.nlpModel,
      openAIApiKey: CONFIG.openRouter.apiKey,
      configuration: {
        baseURL: CONFIG.openRouter.url,
        defaultHeaders: CONFIG.openRouter.defaultHeaders,
      },
    });

    this.vectorStore = await Neo4jVectorStore.fromExistingGraph(
      embeddings,
      CONFIG.neo4j,
    );

    await this.clearAll(CONFIG.neo4j.nodeLabel);

    for (const [index, doc] of documents.entries()) {
      this.debugLog(`Adicionando documento ${index + 1}/${documents.length}`);
      await this.vectorStore.addDocuments([doc]);
    }

    this.indexedDocuments = documents.length;
    this.ai = new AI({
      nlpModel,
      debugLog: this.debugLog,
      vectorStore: this.vectorStore,
      promptConfig: CONFIG.promptConfig,
      templateText: CONFIG.templateText,
      topK: CONFIG.similarity.topK,
    });

    this.debugLog("Base de dados populada com sucesso.");
  }

  async answerQuestion(question: string) {
    if (!this.ai) {
      throw new Error("RAG nao inicializado.");
    }

    return this.ai.answerQuestion(question);
  }

  getStatus() {
    return {
      indexedDocuments: this.indexedDocuments,
      pdfPath: CONFIG.pdf.path,
      topK: CONFIG.similarity.topK,
    };
  }

  async close() {
    await this.vectorStore?.close();
    this.vectorStore = null;
    this.ai = null;
  }

  private async clearAll(nodeLabel: string) {
    if (!this.vectorStore) {
      return;
    }

    this.debugLog("Removendo documentos existentes do indice...");
    await this.vectorStore.query(`MATCH (n:\`${nodeLabel}\`) DETACH DELETE n`);
  }
}
