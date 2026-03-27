// Orquestrador que importa e coloca tudo pra rodar
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { CONFIG } from "./config.ts";
import { DocumentProcessor } from "./documentProcessor.ts";
import { type PretrainedOptions } from "@huggingface/transformers";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { ChatOpenAI } from "@langchain/openai";
import { AI } from "./ai.ts";
import { writeFile, mkdir } from 'node:fs/promises'

let _neo4jVectorStore = null

async function clearAll(vectorStore: Neo4jVectorStore, nodeLabel: string): Promise<void> {
    console.log("🗑️  Removendo todos os documentos existentes...");
    await vectorStore.query(
        `MATCH (n:\`${nodeLabel}\`) DETACH DELETE n`
    )
    console.log("✅ Documentos removidos com sucesso\n");
}


try {
    console.log("🚀 Inicializando sistema de Embeddings com Neo4j...\n");

    // Instanciando o objeto documentProcessor da classe exportada de documentProcessor.ts"
    const documentProcessor = new DocumentProcessor(
        CONFIG.pdf.path,
        CONFIG.textSplitter,
    )
    const documents = await documentProcessor.loadAndSplit() // loadAndSplit(). documents agora é um array de chunks prontos.

    // Instancia o modelo de embeddings do HuggingFace. Converte texto em vetores numéricos
    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: CONFIG.embedding.modelName,
        pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedOptions
    })

    //Instancia o cliente do LLM. ChatOpenAI é o cliente do LangChain pra modelos compatíveis com a API da OpenAI
    //Passa a URL na baseURL e usa qualquer modelo do OpenRouter com o cliente do LangChain.
    const nlpModel = new ChatOpenAI({
        temperature: CONFIG.openRouter.temperature,
        maxRetries: CONFIG.openRouter.maxRetries,
        modelName: CONFIG.openRouter.nlpModel,
        openAIApiKey: CONFIG.openRouter.apiKey,
        configuration: {
            baseURL: CONFIG.openRouter.url,
            defaultHeaders: CONFIG.openRouter.defaultHeaders
        }

    })
    // const response = await embeddings.embedQuery(
    //     "JavaScript"
    // )
    // const response = await embeddings.embedDocuments([
    //     "JavaScript"
    // ])
    // console.log('response', response)

    _neo4jVectorStore = await Neo4jVectorStore.fromExistingGraph(
        embeddings,
        CONFIG.neo4j
    )

    // Limpa tudo e reindexar um por um.
    clearAll(_neo4jVectorStore, CONFIG.neo4j.nodeLabel)
    for (const [index, doc] of documents.entries()) {
        console.log(`✅ Adicionando documento ${index + 1}/${documents.length}`);
        await _neo4jVectorStore.addDocuments([doc])
    }
    console.log("\n✅ Base de dados populada com sucesso!\n");


    // ==================== STEP 2: RUN SIMILARITY SEARCH ====================
    console.log("🔍 ETAPA 2: Executando buscas por similaridade...\n");
    const questions = [
        // "O que são tensores e como são representados em JavaScript?",
        "Como converter objetos JavaScript em tensores?",
        "O que é normalização de dados e por que é necessária?",
        "Como funciona uma rede neural no TensorFlow.js?",
        "O que significa treinar uma rede neural?",
        "o que é hot enconding e quando usar?"
    ]

    // Instancia a classe AI injetando todas as dependências, ela recebe de fora. Facilita para testes e reutilização.
    const ai = new AI({
        nlpModel,
        debugLog: console.log,
        vectorStore: _neo4jVectorStore,
        promptConfig: CONFIG.promptConfig,
        templateText: CONFIG.templateText,
        topK: CONFIG.similarity.topK,
    })

    // Percorre os índices da lista de perguntas
    for (const index in questions) {
        // Obtém o texto da pergunta atual usando o índice
        const question = questions[index]
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📌 PERGUNTA: ${question}`);
        console.log('='.repeat(80));
        // Envia a pergunta para a IA e aguarda a resposta
        const result = await ai.answerQuestion(question!)
        if(result.error) {
            console.log(`\n❌ Erro: ${result.error}\n`);
            continue
        }

        console.log(`\n${result.answer}\n`);

        //// Garante que a pasta de destino das respostas exista
        await mkdir(CONFIG.output.answersFolder, { recursive: true })

        const fileName = `${CONFIG.output.answersFolder}/${CONFIG.output.fileName}-${index}-${Date.now()}.md`
        
        //// Salva o conteúdo da resposta da IA no arquivo Markdown criado
        await writeFile(fileName, result.answer!)
    }


    // Cleanup
    console.log(`\n${'='.repeat(80)}`);
    console.log("✅ Processamento concluído com sucesso!\n");
//O finally sempre executa, com erro ou sem
} catch (error) {
    console.error('error', error)
} finally {
    await _neo4jVectorStore?.close();
}