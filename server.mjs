import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const root = path.resolve("public");

const server = http.createServer(async (req, res) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "same-origin",
    "X-Content-Type-Options": "nosniff"
  };

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    try {
      const page = await readFile(path.join(root, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    } catch {
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: "Сайт файлы табылмады." }));
    }
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    if (!client) {
      res.writeHead(503, headers);
      return res.end(JSON.stringify({ error: "OPENAI_API_KEY орнатылмаған. .env файлын толтырып, серверді қайта іске қосыңыз." }));
    }

    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 20_000) throw new Error("Сұраныс тым үлкен.");
      }
      const data = JSON.parse(raw || "{}");
      const allowedTopics = ["Баскетбол", "Волейбол", "Футбол", "Жеңіл атлетика", "Гимнастика", "Жалпы дене дайындығы"];
      const allowedLevels = ["Бастапқы", "Орташа", "Жоғары"];
      const age = Number(data.age);
      if (!Number.isInteger(age) || age < 6 || age > 18 ||
          typeof data.grade !== "string" ||
          !allowedTopics.includes(data.topic) ||
          !["40 минут", "45 минут", "60 минут"].includes(data.duration) ||
          !allowedLevels.includes(data.level)) {
        res.writeHead(400, headers);
        return res.end(JSON.stringify({ error: "Енгізілген параметрлерді тексеріңіз." }));
      }

      const prompt = `Қазақ тілінде мектептің дене шынықтыру мұғаліміне арналған нақты әрі қауіпсіз сабақ жоспарын құрастыр.
Параметрлер:
- Сынып: ${data.grade}
- Оқушылардың жасы: ${age}
- Тақырып: ${data.topic}
- Ұзақтығы: ${data.duration}
- Дене дайындығы: ${data.level}

Жауап құрылымы:
1. Сабақтың тақырыбы және мақсаты.
2. Оқу міндеттері (3 тармақ).
3. Қажетті құрал-жабдықтар.
4. Сабақ барысы: дайындық, негізгі, қорытынды бөлімдері; әрқайсысына минут бөліп, жалпы уақыт ${data.duration} болсын.
5. Әр бөлімдегі нақты жаттығулар, орындау тәсілі және қайталау/ұзақтығы.
6. Саралау: бастапқы/орташа/жоғары дайындықтағы оқушыға бейімдеу.
7. Бағалау критерийлері және кері байланыс.
8. Қауіпсіздік ережелері.

Жас ерекшелігін ескер; күрделі не қауіпті жаттығулар ұсынба; жүктемені біртіндеп арттыр; міндетті медициналық кеңес немесе диагноз берме. Оқушының денсаулық жағдайы белгісіз екенін ескеріп, мұғалімнің тексеруі қажет екенін қысқа ескерт. Оқу бағдарламасындағы нақты стандарттарға сілтеме ойдан шығарма. Жауапты түсінікті тақырыпшалармен, қазақ тілінде жаз.`;

      const response = await client.responses.create({
        model: MODEL,
        instructions: "Сен Қазақстан мектебіндегі дене шынықтыру пәні бойынша әдістемелік көмекшісің. Қауіпсіз, жас ерекшелігіне сай және практикалық жоспар жаса. Тек қазақ тілінде жауап бер.",
        input: prompt,
        max_output_tokens: 1800
      });

      res.writeHead(200, headers);
      return res.end(JSON.stringify({ plan: response.output_text || "Жоспар жасалмады." }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, headers);
      return res.end(JSON.stringify({ error: "AI сұранысын орындау кезінде қате болды. API кілтін, интернетті және API есептік жазбасын тексеріңіз." }));
    }
  }

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: "Бет табылмады." }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MoveClass іске қосылды: http://localhost:${PORT}`);
});
