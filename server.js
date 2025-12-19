import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY

/* =========================
   HTTP SERVER (static files)
========================= */
const server = http.createServer((req, res) => {
  let filePath = path.join(
    __dirname,
    "public",
    req.url === "/" ? "student.html" : req.url
  )

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("404 · File not found")
      return
    }

    const ext = path.extname(filePath)
    const contentType =
      ext === ".html" ? "text/html" :
      ext === ".css" ? "text/css" :
      ext === ".js" ? "text/javascript" :
      "text/plain"

    res.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` })
    res.end(content)
  })
})

/* =========================
   WEBSOCKET SERVER
========================= */
const wss = new WebSocketServer({ server })
const lessons = new Map()

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    const lessonId = msg.lessonId || "default"

    // 👨‍🏫 Публикация от учителя
    if (msg.type === "publish") {
      console.log("🔑 SERVER KEY:", BWN_KEY)
      console.log("📨 CLIENT KEY:", msg.key)

      if (msg.key !== BWN_KEY) {
        ws.send(JSON.stringify({ type: "error", message: "Bad key" }))
        return
      }

      lessons.set(lessonId, msg.html || "")

      // Рассылка всем ученикам
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "update",
            lessonId,
            html: lessons.get(lessonId),
          }))
        }
      })
    }

    // 👨‍🎓 Подписка ученика
    if (msg.type === "subscribe") {
      ws.send(JSON.stringify({
        type: "update",
        lessonId,
        html: lessons.get(lessonId) || "",
      }))
    }
  })
})

server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on port ${PORT}`)
})
