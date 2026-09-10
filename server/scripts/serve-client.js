import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(currentDirectory, '../../client');
const port = Number(process.env.CLIENT_PORT || 5500);
const app = express();

app.use(express.static(clientDirectory));
app.get('/', (request, response) => response.sendFile(path.join(clientDirectory, 'index.html')));

app.listen(port, () => console.log(`SGEPA frontend disponível em http://localhost:${port}`));
