import { mkdir, writeFile } from "node:fs/promises";
import { CONFIG } from "./config.ts";
import { RagApp } from "./ragApp.ts";

const questions = [
  "Como converter objetos JavaScript em tensores?",
  "O que e normalizacao de dados e por que e necessaria?",
  "Como funciona uma rede neural no TensorFlow.js?",
  "O que significa treinar uma rede neural?",
  "o que e hot enconding e quando usar?",
];

const ragApp = new RagApp();

try {
  await ragApp.initialize();

  for (const index in questions) {
    const question = questions[index]!;
    console.log(`\n${"=".repeat(80)}`);
    console.log(`PERGUNTA: ${question}`);
    console.log("=".repeat(80));

    const result = await ragApp.answerQuestion(question);
    if (result.error) {
      console.log(`\nErro: ${result.error}\n`);
      continue;
    }

    console.log(`\n${result.answer}\n`);

    await mkdir(CONFIG.output.answersFolder, { recursive: true });
    const fileName = `${CONFIG.output.answersFolder}/${CONFIG.output.fileName}-${index}-${Date.now()}.md`;
    await writeFile(fileName, result.answer!);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("Processamento concluido com sucesso.\n");
} catch (error) {
  console.error("error", error);
} finally {
  await ragApp.close();
}
