import http from "http"
import { WebSocketServer } from "ws"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT || 3000
const BWN_KEY = process.env.BWN_KEY

const server = http.createServer((req,res)=>{
  const filePath = path.join(__dirname,"public",req.url==="/"?"student.html":req.url)
  fs.readFile(filePath,(e,c)=>{
    if(e){res.writeHead(404);return res.end("404")}
    res.end(c)
  })
})

const wss = new WebSocketServer({ server })
const lessons = new Map()

wss.on("connection", ws=>{
  ws.on("message", raw=>{
    let msg
    try{msg=JSON.parse(raw)}catch{return}
    const id = msg.lessonId || "lesson-1"

    if(msg.type==="publish"){
      if(msg.key!==BWN_KEY) return
      lessons.set(id,msg.html)
      wss.clients.forEach(c=>c.send(JSON.stringify({type:"update",lessonId:id,html:msg.html})))
    }

    if(msg.type==="cursor"){
      wss.clients.forEach(c=>c.send(JSON.stringify(msg)))
    }

    if(msg.type==="subscribe"){
      ws.send(JSON.stringify({type:"update",lessonId:id,html:lessons.get(id)||""}))
    }
  })
})

server.listen(PORT,()=>console.log("🚀 BYTEWEBNEST Live Lesson running"))
