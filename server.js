import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY || "bwn-live-2025"

/* =========================
   HTTP SERVER (static)
========================= */
const server = http.createServer((req, res) => {
  const filePath = path.join(
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
    const type =
      ext === ".html" ? "text/html" :
      ext === ".css" ? "text/css" :
      ext === ".js" ? "text/javascript" :
      "text/plain"

    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` })
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

    const lessonId = msg.lessonId || "lesson-1"

    // 👨‍🏫 публикация кода
    if (msg.type === "publish") {
      if (msg.key !== BWN_KEY) {
        ws.send(JSON.stringify({ type: "error", message: "Bad key" }))
        return
      }

      lessons.set(lessonId, msg.html || "")

      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "update",
            lessonId,
            html: lessons.get(lessonId)
          }))
        }
      })
    }

    // 🖱️ курсор / выделение
    if (msg.type === "cursor") {
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "cursor",
            lessonId,
            selections: msg.selections
          }))
        }
      })
    }

    // 👨‍🎓 подписка ученика
    if (msg.type === "subscribe") {
      ws.send(JSON.stringify({
        type: "update",
        lessonId,
        html: lessons.get(lessonId) || ""
      }))
    }
  })
})

server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on ${PORT}`)
})
