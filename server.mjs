import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.8-flash";

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

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: "Бет табылмады." }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("MoveClass AI іске қосылды!");
});
