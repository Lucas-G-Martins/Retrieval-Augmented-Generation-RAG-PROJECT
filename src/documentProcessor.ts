// Transformo textos do pdf em chunks
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf" //Importa a classe PDFLoader do LangChain. Ela sabe ler arquivos PDF e transformar cada página em um objeto
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { type TextSplitterConfig } from './config.ts'

// pegar o PDF bruto e devolver pedaços (chunks) de texto prontos pra indexar.
export class DocumentProcessor {
    private pdfPath: string
    private textSplitterConfig: TextSplitterConfig

    // constructor é executado quando você faz new DocumentProcessor(...)
    constructor(pdfPath: string, textSplitterConfig: TextSplitterConfig) {
        this.pdfPath = pdfPath // recebe os dois parâmetros e os guarda nas propriedades da instância via this
        this.textSplitterConfig = textSplitterConfig  // o objeto criado "sabe" qual PDF processar e como dividir.
    }


    async loadAndSplit() {
        const loader = new PDFLoader(this.pdfPath) //Cria uma instância de PDFLoader passando o caminho do PDF
        const rawDocuments = await loader.load()
        console.log(`📄 Loaded ${rawDocuments.length} pages from PDF`); //loader.load() retorna uma Promise<Document[]> — um array de objetos onde cada um representa uma página.

        // instancia o splitter passando { chunkSize: 1000, chunkOverlap: 200 } que veio lá do config.ts
        const splitter = new RecursiveCharacterTextSplitter(
            this.textSplitterConfig
        )
        const documents = await splitter.splitDocuments(rawDocuments) //recebe o array de páginas e devolve um array muito maior — cada página virou vários chunks
        console.log(`✂️  Split into ${documents.length} chunks`);

        return documents.map(doc => ({ // .map() percorre cada chunk e cria um novo objeto.
            ...doc,
            metadata: {
                source: doc.metadata.source,
            }
        }))
    }
}