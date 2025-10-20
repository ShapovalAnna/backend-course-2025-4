
const { program } = require("commander");
const http = require("http");
const url = require('url');
const { readFile, existsSync } = require("fs"); 
const fsPromises = require("fs/promises");
const path = require("path");
const { XMLBuilder } = require("fast-xml-parser");


program
  .requiredOption("-i, --input <path>", "path to input JSON file")
  .requiredOption("-h, --host <host>", "server host address")
  .requiredOption("-p, --port <port>", "server port number");

program.parse(process.argv);
const options = program.opts();

if (!existsSync(options.input)) {
  console.error("Cannot find input file");
  process.exit(1);
}

const requestHandler = async (req, res) => {
      try {
    const url = new URL(req.url, `http://${options.host}:${options.port}`);
    const survivedParam = url.searchParams.get("survived");
    const ageParam = url.searchParams.get("age");

    
    const rawData = await fsPromises.readFile(path.resolve(options.input), "utf8");

   
    const lines = rawData.trim().split("\n");
   
    let jsonArray = lines.map(line => JSON.parse(line)); 
    


    // Фільтрація за survived 
if (survivedParam === "true") {
  jsonArray = jsonArray.filter(p =>
    p.Survived === 1 || p.Survived === "1" || p.Survived === true || p.Survived === "true"
  );
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

// Передаємо асинхронний обробник запиту
const server = http.createServer(requestHandler);

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});