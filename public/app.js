const form = document.querySelector("#question-form");
const questionField = document.querySelector("#question");
const submitButton = document.querySelector("#submit-button");
const answerEl = document.querySelector("#answer");
const contextEl = document.querySelector("#context");
const requestStateEl = document.querySelector("#request-state");
const scoreStateEl = document.querySelector("#score-state");
const statsEl = document.querySelector("#stats");
const statusPillEl = document.querySelector("#status-pill");
const exampleButton = document.querySelector("[data-fill-question]");

const exampleQuestion = "Como converter objetos JavaScript em tensores?";

function setArticleContent(element, content) {
  element.textContent = content;
  element.classList.toggle("empty", !content);
}

function fillStats(data) {
  const values = [
    data.indexedDocuments ?? "-",
    data.pdfPath ?? "-",
    data.topK ?? "-",
    data.port ?? "-",
  ];

  [...statsEl.querySelectorAll("dd")].forEach((item, index) => {
    item.textContent = values[index];
  });
}

async function loadHealth() {
  statusPillEl.textContent = "Carregando base...";

  const response = await fetch("/api/health");
  const data = await response.json();

  fillStats(data);
  statusPillEl.textContent = data.ok ? "Base pronta" : "Indisponivel";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionField.value.trim();
  if (!question) {
    questionField.focus();
    return;
  }

  submitButton.disabled = true;
  requestStateEl.textContent = "Buscando contexto e gerando resposta";
  scoreStateEl.textContent = "Calculando score";
  setArticleContent(answerEl, "");
  setArticleContent(contextEl, "");

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();

    requestStateEl.textContent = response.ok
      ? "Resposta recebida"
      : "Consulta com erro";
    scoreStateEl.textContent = data.topScore
      ? `Melhor score: ${Number(data.topScore).toFixed(3)}`
      : "Sem score util";

    setArticleContent(answerEl, data.answer || data.error || "Sem conteudo.");
    setArticleContent(contextEl, data.context || "Nenhum trecho retornado.");
  } catch (error) {
    console.error(error);
    requestStateEl.textContent = "Falha de conexao";
    scoreStateEl.textContent = "Sem score";
    setArticleContent(answerEl, "Nao foi possivel consultar a API.");
    setArticleContent(contextEl, "");
  } finally {
    submitButton.disabled = false;
  }
});

exampleButton.addEventListener("click", () => {
  questionField.value = exampleQuestion;
  questionField.focus();
});

loadHealth().catch((error) => {
  console.error(error);
  statusPillEl.textContent = "Falha ao conectar";
  requestStateEl.textContent = "API indisponivel";
});
