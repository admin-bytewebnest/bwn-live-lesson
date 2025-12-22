import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;
const BWN_KEY = process.env.BWN_KEY || "bwn-live-2025";

// lessonId -> { html: string, cursor: {from,to} }
const lessons = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("BYTEWEBNEST · Live Lesson Server is running ✅");
});

// WS на /ws
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data);
  });
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const lessonId = msg.lessonId || "default";
    const state = lessons.get(lessonId) || { html: "", cursor: null };

    if (msg.type === "subscribe") {
      // студенту отдаём последнее состояние
      ws.send(
        JSON.stringify({ type: "code", lessonId, html: state.html || "" })
      );
      if (state.cursor) {
        ws.send(
          JSON.stringify({ type: "cursor", lessonId, ...state.cursor })
        );
      }
      return;
    }

    // Всё, что меняет состояние (teacher) — защищаем ключом
    const isTeacherMsg = msg.type === "code" || msg.type === "cursor";
    if (isTeacherMsg) {
      if (msg.key !== BWN_KEY) {
        ws.send(JSON.stringify({ type: "error", message: "Bad key" }));
        return;
      }
    }

    if (msg.type === "code") {
      state.html = String(msg.html || "");
      lessons.set(lessonId, state);
      broadcast({ type: "code", lessonId, html: state.html });
      return;
    }

    if (msg.type === "cursor") {
      // from/to: {line, ch}
      const from = msg.from;
      const to = msg.to;
      if (!from || !to) return;

      state.cursor = { from, to };
      lessons.set(lessonId, state);
      broadcast({ type: "cursor", lessonId, from, to });
      return;
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on port ${PORT}`);
});
