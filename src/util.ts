import type { Document } from "@langchain/core/documents";

// Recebe um array de Document. O tipo Record<string, any> é o metadata — um objeto com chaves string 
function displayResults(results: Array<Document<Record<string, any>>>): void {
    console.log(`\n📄 Encontrados ${results.length} trechos relevantes:\n`);

    // forEach percorre cada documento. doc.metadata?.pageNumber — o ? é optional chaining, não estoura erro se metadata for undefined.
    results.forEach((doc, index) => {
        console.log(`   ${index + 1}.`);
        console.log(`      ${formatContent(doc.pageContent)}`);
        if (doc.metadata?.pageNumber) {
            console.log(`      📄 (Página: ${doc.metadata.pageNumber})`);
        }
        console.log();
    });
}

function formatContent(content: string, maxLength: number = 200): string {

    //content.replace(/\s+/g, ' ') — regex que substitui qualquer sequência de espaços, tabs e quebras de linha por um único espaço.
    const cleaned = content.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength
        ? `${cleaned.substring(0, maxLength)}...` // // O que acontece se for TRUE
        : cleaned; // // O que acontece se for FALSE
}

export {
    displayResults
}