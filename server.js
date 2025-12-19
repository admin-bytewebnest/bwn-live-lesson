import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const BWN_KEY = process.env.BWN_KEY || "bwn-live-2025";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("BYTEWEBNEST Live Lesson server is running ✅");
});

const wss = new WebSocketServer({ server });

// простая "комната" по lessonId
const lessons = new Map(); // lessonId -> lastHTML

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // msg: {type, lessonId, key?, html?}
    const lessonId = msg.lessonId || "default";

    if (msg.type === "publish") {
      // защита: публиковать может только учитель
      if (msg.key !== BWN_KEY) {
        ws.send(JSON.stringify({ type: "error", message: "Bad key" }));
        return;
      }
      lessons.set(lessonId, msg.html || "");
      // рассылаем всем
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "update", lessonId, html: lessons.get(lessonId) }));
        }
      });
    }

    if (msg.type === "subscribe") {
      // сразу отдаём последнее состояние
      ws.send(JSON.stringify({ type: "update", lessonId, html: lessons.get(lessonId) || "" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
