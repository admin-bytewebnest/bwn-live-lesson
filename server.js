import http from "http"
import { WebSocketServer } from "ws"

const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
  res.end("BYTEWEBNEST · Live Lesson Server is running ✅")
})

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

    if (msg.type === "publish") {
      console.log("🔑 SERVER KEY:", BWN_KEY)
      console.log("📨 CLIENT KEY:", msg.key)

      if (msg.key !== BWN_KEY) {
        ws.send(JSON.stringify({ type: "error", message: "Bad key" }))
        return
      }

      lessons.set(lessonId, msg.html || "")

      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: "update",
              lessonId,
              html: lessons.get(lessonId),
            })
          )
        }
      })
    }

    if (msg.type === "subscribe") {
      ws.send(
        JSON.stringify({
          type: "update",
          lessonId,
          html: lessons.get(lessonId) || "",
        })
      )
    }
  })
})

server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on port ${PORT}`)
})
