//Centraliza todas as configurações
import type { DataType, PretrainedModelOptions } from "@huggingface/transformers";
import { readFileSync } from 'node:fs'

const promptsFolder = './prompts';
const promptsFiles = {
    answerPrompt: `${promptsFolder}/answerPrompt.json`,
    template: `${promptsFolder}/template.txt`,
};

export interface TextSplitterConfig {
    chunkSize: number;
    chunkOverlap: number;
}

// Lê variáveis de ambientes e arquivos de texto
export const CONFIG = Object.freeze({ // Object.freeze() é um método nativo do JavaScript que congela o objeto
    promptConfig: JSON.parse(readFileSync(promptsFiles.answerPrompt, 'utf-8')), // readFileSync lê o arquivo answerPrompt.json do disco de forma síncrona (trava a execução até terminar) e retorna uma string
    templateText: readFileSync(promptsFiles.template, 'utf-8'),
    output: {
        answersFolder: './respostas',
        fileName: 'resposta',
    },
    neo4j: {
        url: process.env.NEO4J_URI!,
        username: process.env.NEO4J_USER!,
        password: process.env.NEO4J_PASSWORD!,
        indexName: "tensors_index",
        searchType: "vector" as const,
        textNodeProperties: ["text"],
        nodeLabel: "Chunk", // é o nome do nó no grafo Neo4j — cada pedaço do PDF vai virar um nó chamado Chunk.
    },
    openRouter: {
        nlpModel: process.env.NLP_MODEL,
        url: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        temperature: 0.3,
        maxRetries: 2, //se a API falhar, tenta mais 2 vezes antes de lançar erro
        defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
            "X-Title": process.env.OPENROUTER_SITE_NAME,
        }
    },
    pdf: {
        path: "./tensores.pdf",
    },
    textSplitter: {
        chunkSize: 1000,
        chunkOverlap: 200, //os últimos 200 caracteres de um chunk aparecem também no início do próximo
    },
    embedding: {
        modelName: process.env.EMBEDDING_MODEL!,
        pretrainedOptions: {
            dtype: "fp32" as DataType, // Options: 'fp32' (best quality), 'fp16' (faster), 'q8', 'q4', 'q4f16' (quantized)
        } satisfies PretrainedModelOptions,
    },
    similarity: {
        topK: 3, //me dá os 3 chunks mais similares à pergunta
    },
});
