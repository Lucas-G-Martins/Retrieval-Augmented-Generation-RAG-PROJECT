//Busco contexto e gero resposta
import { type Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { StringOutputParser } from "@langchain/core/output_parsers"; //transforma a resposta do LLM em string pura
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai"; // 


// Processa o PDF em chunks
// Instancia os embeddings (HuggingFace local)
// Instancia o LLM (OpenRouter remoto)
// Conecta no Neo4j, limpa tudo, reindexar os chunks
// Para cada pergunta, chama ai.answerQuestion() e salva o .md

// Tipo que descreve o objeto de configuração que a classe AI espera receber.
type DebugLog = (...args: unknown[]) => void;
type params = {
    debugLog: DebugLog,
    vectorStore: Neo4jVectorStore,
    nlpModel: ChatOpenAI,
    promptConfig: any,
    templateText: string,
    topK: number,
}

// viaja pelo pipeline
// ? marca campos opcionais
interface ChainState {
    question: string;
    context?: string;
    topScore?: number;
    error?: string;
    answer?: string;
}

// recebe uma pergunta e devolve uma resposta fundamentada no PDF.
export class AI {
    private params: params
    constructor(params: params) {
        this.params = params
    }

    // Busco no Neo4j resposta relacionada a pergunta
    async retrieveVectorSearchResults(input: ChainState): Promise<ChainState> { //  recebe um ChainState e devolve um Promise<ChainState> — ou seja, recebe e devolve o mesmo tipo de envelope, mas enriquecido.
        this.params.debugLog("🔍 Buscando no vector store do Neo4j...");
        const vectorResults = await this.params.vectorStore.similaritySearchWithScore(input.question, this.params.topK); // Chama o Neo4j pedindo os chunks mais similares à pergunta.

        if (!vectorResults.length) {
            this.params.debugLog("⚠️  Nenhum resultado encontrado no vector store.");
            return {
                ...input,
                error: "Desculpe, não encontrei informações relevantes sobre essa pergunta na base de conhecimento."
            };
        }

        const topScore = vectorResults[0]![1]
        this.params.debugLog(`✅ Encontrados ${vectorResults.length} resultados relevantes (melhor score: ${topScore.toFixed(3)})`);

        const contexts = vectorResults
            .filter(([, score]) => score > 0.5) //Descarta resultados com menos de 50% de similaridade
            .map(([doc]) => doc.pageContent)
            .join("\n\n---\n\n");

        return {
            ...input,
            context: contexts,
            topScore,
        }
    }

    // Geração da resposta pela IA depois de encontrar o assunto relacionado no Neo4j
    async generateNLPResponse(input: ChainState): Promise<ChainState> {
        if (input.error) return input
        this.params.debugLog("🤖 Gerando resposta com IA...");

        // Cria um template de prompt a partir do texto lido lá do template.txt
        const responsePrompt = ChatPromptTemplate.fromTemplate(
            this.params.templateText
        )
        const responseChain = responsePrompt
            .pipe(this.params.nlpModel) // Monta uma mini-cadeia com .pipe()
            .pipe(new StringOutputParser()) // O StringOutputParser converte a resposta do modelo (que vem como objeto complexo) em string simples

        const rawResponse = await responseChain.invoke({
            role: this.params.promptConfig.role,
            task: this.params.promptConfig.task,
            tone: this.params.promptConfig.constraints.tone,
            language: this.params.promptConfig.constraints.language,
            format: this.params.promptConfig.constraints.format,
            //O .map().join() nas instructions transforma o array ["Faça X", "Faça Y"] em "1. Faça X\n2. Faça Y" — uma lista numerada em string.
            instructions: this.params.promptConfig.instructions.map((instruction: string, idx: number) =>
                `${idx + 1}. ${instruction}`
            ).join('\n'),
            question: input.question,
            context: input.context
        })

        return {
            ...input,
            answer: rawResponse,
        }
    }

    //Monta o pipeline completo, encadeia as funções de entrada e saída
    async answerQuestion(question: string) {
        const chain = RunnableSequence.from([
            this.retrieveVectorSearchResults.bind(this), //O .bind(this) fixa o contexto da classe
            this.generateNLPResponse.bind(this)
        ])

        //Dispara o pipeline inteiro passando só a pergunta
        const result = await chain.invoke({ question })
        this.params.debugLog("\n🎙️  Pergunta:");
        this.params.debugLog(question, "\n");
        this.params.debugLog("💬 Resposta:");
        this.params.debugLog(result.answer || result.error, "\n");

        return result

    }
}