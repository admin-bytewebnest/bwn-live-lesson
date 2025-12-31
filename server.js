import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import fetch from "node-fetch"
import formidable from "formidable"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------
// Конфиг
// ---------------------
const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY

const GITHUB_OWNER = process.env.GITHUB_OWNER
const GITHUB_REPO = process.env.GITHUB_REPO
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main"
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

// ---------------------
// HTTP сервер
// ---------------------
const server = http.createServer(async (req, res) => {
  try {
    // -------------------
    // 1) API для загрузки домашки
    // -------------------
    if (req.method === "POST" && req.url === "/api/upload-homework") {
      const form = formidable({ multiples: false })
      form.parse(req, async (err, fields, files) => {
        if (err) {
          res.writeHead(500)
          return res.end("Ошибка парсинга формы")
        }

        const student = (fields.student || "unknown").replace(/\s+/g, "_")
        const file = files.file
        if (!file) {
          res.writeHead(400)
          return res.end("Файл не найден")
        }

        const content = fs.readFileSync(file.filepath, "utf-8")
        const githubPath = `homeworks/lesson-1/${student}.html`

        // Загружаем на GitHub
        try {
          await uploadToGitHub(githubPath, content, `HW by ${student}`)
          res.writeHead(200)
          res.end("ОК")
        } catch (e) {
          console.error(e)
          res.writeHead(500)
          res.end("Ошибка загрузки на GitHub")
        }
      })
      return
    }

    // -------------------
    // 2) Раздача статических файлов
    // -------------------
    let cleanUrl = new URL(req.url, `http://${req.headers.host}`).pathname

    // убираем ведущий слэш
    if (cleanUrl.startsWith("/")) cleanUrl = cleanUrl.slice(1)

    // по умолчанию student.html
    if (cleanUrl === "") cleanUrl = "student.html"

    const filePath = path.join(__dirname, "public", cleanUrl)

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404)
        return res.end("404")
      }
      res.end(content)
    })
  } catch (e) {
    console.error(e)
    res.writeHead(500)
    res.end("500 Internal Server Error")
  }
})

// ---------------------
// WebSocket для live lesson
// ---------------------
const wss = new WebSocketServer({ server })
const lessons = new Map()

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    const id = msg.lessonId || "lesson-1"

    if (msg.type === "publish") {
      if (msg.key !== BWN_KEY) return
      lessons.set(id, msg.html)

      // Отправляем всем клиентам
      wss.clients.forEach(c => {
        if (c.readyState === 1) {
          c.send(JSON.stringify({
            type: "update",
            lessonId: id,
            html: msg.html
          }))
        }
      })
    }

    if (msg.type === "cursor") {
      wss.clients.forEach(c => {
        if (c.readyState === 1) {
          c.send(JSON.stringify(msg))
        }
      })
    }

    if (msg.type === "subscribe") {
      ws.send(JSON.stringify({
        type: "update",
        lessonId: id,
        html: lessons.get(id) || ""
      }))
    }
  })
})

// ---------------------
// Функция загрузки на GitHub
// ---------------------
async function uploadToGitHub(pathInRepo, content, message) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${pathInRepo}`

  // Проверяем, есть ли файл уже
  const existing = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  }).then(r => r.json())

  const sha = existing.sha || undefined

  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch: GITHUB_BRANCH,
    sha
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) throw new Error("Ошибка GitHub API: " + res.statusText)
  return res.json()
}

// ---------------------
server.listen(PORT, () => {
  console.log(`🚀 BYTEWEBNEST Live Lesson running on port ${PORT}`)
})
