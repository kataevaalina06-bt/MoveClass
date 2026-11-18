import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.5-flash-lite";

const server = http.createServer(async (req, res) => {
  const headers = { "Content-Type": "application/json; charset=utf-8" };

  if (req.method === "GET" && req.url === "/") {
    try {
      const page = await readFile(path.resolve("public/index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    } catch {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: "Сайт файлы табылмады." }));
    }
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    if (!API_KEY) {
      res.writeHead(503, headers);
      return res.end(JSON.stringify({ error: "Gemini API кілті орнатылмаған." }));
    }

    try {
      let body = "";
      for await (const chunk of req) body += chunk;

      const data = JSON.parse(body);

      const prompt = `
Сен Қазақстан мектебінің дене шынықтыру пәні бойынша кәсіби әдістемелік көмекшісісің.
Тек қазақ тілінде толық сабақ жоспарын құрастыр.

Сынып: ${data.grade}
Оқушы жасы: ${data.age}
Сабақ тақырыбы: ${data.topic}
Ұзақтығы: ${data.duration}
Дене дайындығы: ${data.level}

Жоспарда міндетті түрде:
1. Сабақтың мақсаты.
2. Оқу міндеттері.
3. Құрал-жабдықтар.
4. Дайындық бөлімі.
5. Негізгі бөлім және нақты жаттығулар.
6. Қорытынды бөлім.
7. Әр жаттығудың орындалу уақыты.
8. Бағалау критерийлері.
9. Қауіпсіздік ережелері.

Жаттығуларды оқушылардың жасына және дене дайындығына бейімде.
Жалпы сабақ уақыты ${data.duration} болуы керек.
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Gemini error:", result);
        res.writeHead(502, headers);
        return res.end(JSON.stringify({
          error: "AI қатесі. API кілтін немесе лимитті тексеріңіз."
        }));
      }

      const plan = result.candidates[0].content.parts
        .map(part => part.text || "")
        .join("\n");

      res.writeHead(200, headers);
      return res.end(JSON.stringify({ plan }));

    } catch (error) {
      console.error(error);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({
        error: "Сабақ жоспарын құрастыру мүмкін болмады."
      }));
    }
  }
  // AI SPORT SIMULATOR QUESTIONS
  if (req.method === "POST" && req.url === "/api/simulator-questions") {
    if (!API_KEY) {
      res.writeHead(503, headers);
      return res.end(JSON.stringify({
        error: "Gemini API кілті орнатылмаған."
      }));
    }

    try {
      let body = "";
      for await (const chunk of req) body += chunk;

      const data = JSON.parse(body);

      const prompt = `
Сен Қазақстан мектептеріне арналған кәсіби дене шынықтыру оқытушысысың.

Оқушыға арналған спорттық симулятор үшін қазақ тілінде 15 тест сұрағын құрастыр.

Спорт түрі: ${data.sport}
Сынып: ${data.grade || "7-сынып"}
Жас ерекшелігі: ${data.age || "13 жас"}
Күрделілік деңгейі: ${data.level || "Орташа"}

Талаптар:
1. Спорт тарихы мен теориясы.
2. Ойын ережелері.
3. Спорт алаңы мен құрал-жабдықтар.
4. Орындау техникасы.
5. Қауіпсіздік ережелері.
6. Практикалық жағдайларды талдау.

Әр сұрақта 4 жауап нұсқасы болсын.
Тек бір жауап дұрыс болсын.
Әр сұраққа түсіндірме бер.
Сұрақтар бір-бірін қайталамасын.

Жауапты тек JSON форматында бер:
{
  "questions": [
    {
      "question": "Сұрақ мәтіні",
      "options": ["A жауабы", "B жауабы", "C жауабы", "D жауабы"],
      "correct": 0,
      "explanation": "Түсіндірме"
    }
  ]
}

correct мәні 0-ден 3-ке дейінгі дұрыс жауаптың индексі болуы керек.
Дұрыс жауаптың орнын әр сұрақта өзгертіп отыр.
`;

      const response = await fetch(
        \`https://generativelanguage.googleapis.com/v1beta/models/\${MODEL}:generateContent\`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Gemini simulator error:", result);
        res.writeHead(502, headers);
        return res.end(JSON.stringify({
          error: "AI сұрақтарды құрастыра алмады."
        }));
      }

      const textResult = result.candidates[0].content.parts
        .map(part => part.text || "")
        .join("");

      const quiz = JSON.parse(textResult);

      if (!Array.isArray(quiz.questions) || quiz.questions.length !== 15) {
        throw new Error("AI 15 сұрақты толық құрастырмады.");
      }

      for (const q of quiz.questions) {
        if (
          typeof q.question !== "string" ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          !Number.isInteger(q.correct) ||
          q.correct < 0 ||
          q.correct > 3 ||
          typeof q.explanation !== "string"
        ) {
          throw new Error("AI сұрақтарының форматы дұрыс емес.");
        }
      }

      res.writeHead(200, headers);
      return res.end(JSON.stringify(quiz));

    } catch (error) {
      console.error("Simulator error:", error);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({
        error: "AI тестін құрастыру мүмкін болмады."
      }));
    }
  }
  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: "Бет табылмады." }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("MoveClass AI іске қосылды!");
});
