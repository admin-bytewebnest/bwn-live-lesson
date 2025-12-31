// server.js
import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import https from "https"
import formidable from "formidable"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY

// =======================
// 1️⃣ GitHub функция
// =======================
function saveToGitHub(filename, content) {
  return new Promise((resolve, reject) => {
    const owner  = process.env.GITHUB_OWNER
    const repo   = process.env.GITHUB_REPO
    const branch = process.env.GITHUB_BRANCH || "main"
    const token  = process.env.GITHUB_TOKEN

    const pathInRepo = filename

    const data = JSON.stringify({
      message: `Update ${filename}`,
      content: Buffer.from(content).toString("base64"),
      branch
    })

    const options = {
      hostname: "api.github.com",
      path: `/repos/${owner}/${repo}/contents/${pathInRepo}`,
      method: "PUT",
      headers: {
        "User-Agent": "BYTEWEBNEST",
        "Authorization": `token ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    }

    const req = https.request(options, res => {
      if (res.statusCode >= 200 && res.statusCode < 300) resolve()
      else reject()
    })

    req.on("error", reject)
    req.write(data)
    req.end()
  })
}

// =======================
// 2️⃣ HTTP server
// =======================
const server = http.createServer(async (req, res) => {

  // ===== API: сохранение урока в GitHub =====
  if (req.method === "POST" && req.url === "/api/save-lesson") {
    let body = ""
    req.on("data", chunk => body += chunk)
    req.on("end", async () => {
      try {
        const { lessonId, filename, content, key } = JSON.parse(body)
        if (key !== BWN_KEY) return res.writeHead(403) && res.end("Forbidden")

        await saveToGitHub(filename, content)

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok:true }))
      } catch (e) {
        console.error(e)
        res.writeHead(500)
        res.end("GitHub save error")
      }
    })
    return
  }

  // ===== API: загрузка домашки =====
  if (req.method === "POST" && req.url === "/api/upload-homework") {
    const form = formidable({ multiples:false })
    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.writeHead(400)
        return res.end("Upload error")
      }

      const student = fields.student
      const file = files.file
      if (!student || !file) {
        res.writeHead(400)
        return res.end("Missing fields")
      }

      const content = fs.readFileSync(file.filepath, "utf8")
      const safeName = student.replace(/[^\w-]/g,"_")

      try {
        await saveToGitHub(`homeworks/lesson-1/${safeName}.html`, content)
        res.writeHead(200)
        res.end("OK")
      } catch (e) {
        console.error(e)
        res.writeHead(500)
        res.end("GitHub save error")
      }
    })
    return
  }

  // ===== Раздача статических файлов =====
  const filePath = path.join(
    __dirname,
    "public",
    req.url === "/" ? "student.html" : req.url
  )

  fs.readFile(filePath,(err,content)=>{
    if(err){
      res.writeHead(404)
      return res.end("404")
    }
    res.end(content)
  })
})

// =======================
// 3️⃣ WebSocket
// =======================
const wss = new WebSocketServer({ server })
const lessons = new Map()

wss.on("connection", ws=>{
  ws.on("message", raw=>{
    let msg
    try{ msg = JSON.parse(raw) } catch { return }

    const id = msg.lessonId || "lesson-1"

    if(msg.type==="publish"){
      if(msg.key !== BWN_KEY) return
      lessons.set(id, msg.html)

      wss.clients.forEach(c=>{
        if(c.readyState===1){
          c.send(JSON.stringify({
            type:"update",
            lessonId:id,
            html:msg.html
          }))
        }
      })
    }

    if(msg.type==="cursor"){
      wss.clients.forEach(c=>{
        if(c.readyState===1){
          c.send(JSON.stringify(msg))
        }
      })
    }

    if(msg.type==="subscribe"){
      ws.send(JSON.stringify({
        type:"update",
        lessonId:id,
        html: lessons.get(id) || ""
      }))
    }
  })
})

// =======================
// 4️⃣ Запуск сервера
// =======================
server.listen(PORT, ()=> {
  console.log("🚀 BYTEWEBNEST Live Lesson running on port", PORT)
})
