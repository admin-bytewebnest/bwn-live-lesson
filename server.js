import http from "http";
import { WebSocketServer } from "ws";

/**
 * =========================
 * CONFIG
 * =========================
 */
const PORT = process.env.PORT || 3000;
const BWN_KEY = process.env.BWN_KEY || "bwn-live-2025";

/**
 * =========================
 * HTTP SERVER
 * =========================
 */
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("BYTEWEBNEST · Live Lesson Server is running ✅");
});

/**
 * =========================
 * WEBSOCKET SERVER
 * =========================
 */
const wss = new WebSocketServer({ server });

/**
 * lessonId -> lastHTML
 */
const lessons = new Map();

/**
 * =========================
 * CONNECTION HANDLING
 * =========================
 */
wss.on("connection", (ws) => {
  ws.lessonId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const lessonId = msg.lessonId || "default";

    /**
     * =========================
     * SUBSCRIBE (ученик)
     * =========================
     */
    if (msg.type === "subscribe") {
      ws.lessonId = lessonId;

      ws.send(
        JSON.stringify({
          type: "update",
          lessonId,
          html: lessons.get(lessonId) || "",
        })
      );
    }

    /**
     * =========================
     * PUBLISH (учитель)
     * =========================
     */
    if (msg.type === "publish") {
      if (msg.key !== BWN_KEY) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Unauthorized publish attempt",
          })
        );
        return;
      }

      lessons.set(lessonId, msg.html || "");

      // Рассылаем ТОЛЬКО подписанным на этот урок
      wss.clients.forEach((client) => {
        if (
          client.readyState === 1 &&
          client.lessonId === lessonId
        ) {
          client.send(
            JSON.stringify({
              type: "update",
              lessonId,
              html: lessons.get(lessonId),
            })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    ws.lessonId = null;
  });
});

/**
 * =========================
 * HEARTBEAT (очень важно для Railway)
 * =========================
 */
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  });
}, 20000);

/**
 * =========================
 * START SERVER
 * =========================
 */
server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on port ${PORT}`);
});
