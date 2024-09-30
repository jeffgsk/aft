import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import cors from 'cors';

const app = express();
app.use(cors());

// Use middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Workaround for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static files middleware
app.use(express.static('public'));

// Serve sender.html on the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});


app.post('/search', async (req, res) => {
    const { searchPath, extensions } = req.body;

    if (!searchPath) {
        return res.status(400).send('Invalid or missing path parameter.');
    }

    try {
        await fs.access(searchPath);  // Check if the directory exists
    } catch (err) {
        return res.status(400).send('Path does not exist.');
    }

    if (!extensions || !Array.isArray(extensions) || extensions.length === 0) {
        return res.status(400).send('Extensions array cannot be null or empty.');
    }

    const getAllFiles = async (dirPath, arrayOfFiles = []) => {
        const files = await fs.readdir(dirPath);

        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                arrayOfFiles = await getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        }

        return arrayOfFiles;
    };

    try {
        const allFiles = await getAllFiles(searchPath);

        const filteredFiles = allFiles
            .filter(file => extensions.includes(path.extname(file)))
            .map(file => ({
                relativePath: path.relative(searchPath, file)
            }));

        return res.status(200).json(filteredFiles);
    } catch (err) {
        return res.status(500).send('Error reading directory.');
    }
});

app.post('/file-content', async (req, res) => {
    const { rootPath, relativeFilePath } = req.body;

    if (!rootPath) {
        return res.status(400).send('Invalid or missing rootPath parameter.');
    }

    try {
        await fs.access(rootPath);  // Check if the rootPath exists
    } catch (err) {
        return res.status(400).send('Root path does not exist.');
    }

    const fullPath = path.join(rootPath, relativeFilePath);

    try {
        await fs.access(fullPath);  // Check if the file exists
    } catch (err) {
        return res.status(404).send('File not found.');
    }

    try {
        const fileContent = await fs.readFile(fullPath, 'utf8');
        res.status(200).json({ content: fileContent });
    } catch (err) {
        return res.status(500).send('Error reading file.');
    }
});


app.listen(3002, () => {
    console.log('Sender app listening on port 3002!');
});
