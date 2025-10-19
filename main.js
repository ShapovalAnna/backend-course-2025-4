
const { program } = require("commander");
const http = require("http");

const { readFile, existsSync } = require("fs"); 
const fsPromises = require("fs/promises");
const path = require("path");
const { XMLBuilder } = require("fast-xml-parser");

// --- 1. Параметри командного рядка 
program
  .requiredOption("-i, --input <path>", "path to input JSON file")
  .requiredOption("-h, --host <host>", "server host address")
  .requiredOption("-p, --port <port>", "server port number");

program.parse(process.argv);
const options = program.opts();

// Використовуємо синхронний existsSync, оскільки це відбувається ОДИН РАЗ при старті програми
if (!existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

// --- 3. Функція обробки HTTP-запиту (Асинхронна) ---
const requestHandler = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${options.host}:${options.port}`);
    const survivedParam = url.searchParams.get("survived");
    const ageParam = url.searchParams.get("age");

    // АСИНХРОННЕ ЧИТАННЯ ФАЙЛУ ЗА ДОПОМОГОЮ fs/promises
    const rawData = await fsPromises.readFile(path.resolve(options.input), "utf8");

    // Обробка даних (Ваша логіка)
    const lines = rawData.trim().split("\n");
    // Припускаємо, що titanic.json є цілісним масивом, а не JSON-L
    let jsonArray = lines.map(line => JSON.parse(line)); 
     // Якщо файл містить JSON-L (рядок за рядком), використовуйте:
     // let jsonArray = lines.map(line => JSON.parse(line));


    // Фільтрація за survived (Варіант 6)
    if (survivedParam === "true") {
      // Фільтруємо за числовим полем Survived (1 або 0)
      jsonArray = jsonArray.filter(p => p.Survived === 1); 
    }

    // Формування об'єктів для XML
    const passengers = jsonArray.map(p => {
      const passenger = {
        name: p.Name,
        ticket: p.Ticket || 'N/A',
      };
      // Умовне додавання поля 'age'
      if (ageParam === "true" && p.Age !== undefined && p.Age !== null) {
        passenger.age = p.Age;
      }
      return passenger;
    });

    // Формування XML за допомогою fast-xml-parser
    const builder = new XMLBuilder({ 
         format: true,
         arrayNodeName: "passenger" // Правильно обгортає елементи масиву
    });
    const xmlData = builder.build({ passengers: { passenger: passengers } });

    // Надсилання відповіді
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(xmlData);
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error: Could not read file or process JSON.");
  }
};

// --- 4. Запуск сервера ---
// Передаємо асинхронний обробник запиту
const server = http.createServer(requestHandler);

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});