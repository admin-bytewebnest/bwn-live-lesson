import fetch from "node-fetch";

// Получаем переменные из окружения
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH;
const TOKEN = process.env.GITHUB_TOKEN;

if (!OWNER || !REPO || !BRANCH || !TOKEN) {
  console.error("❌ Одна или несколько переменных окружения отсутствуют!");
  process.exit(1);
}

const FILE_PATH = "test.txt"; // файл, который будет создан/обновлён
const COMMIT_MESSAGE = "Test commit from Render";
const CONTENT = Buffer.from("Это тестовый файл для проверки GitHub API").toString("base64");

async function testGitHub() {
  try {
    // 1. Проверяем существует ли файл
    const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${TOKEN}` }
    });

    let sha;
    if (getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha; // нужен для обновления файла
      console.log("Файл уже существует, обновим его");
    } else {
      console.log("Файл не найден, создаём новый");
    }

    // 2. Создаём или обновляем файл
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: COMMIT_MESSAGE,
        content: CONTENT,
        branch: BRANCH,
        sha: sha // если файла не было, sha = undefined
      })
    });

    const result = await res.json();
    if (res.ok) {
      console.log("✅ Файл успешно создан/обновлён:", result.content.path);
    } else {
      console.error("❌ Ошибка GitHub API:", result);
    }
  } catch (err) {
    console.error("❌ Ошибка:", err);
  }
}

testGitHub();
