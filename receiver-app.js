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
    res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});


app.post('/upload', async (req, res) => {
    const { path: filePath, content } = req.body;
    const buffer = Buffer.from(content, 'base64');

    // Construct the full file path
    const fullFilePath = path.normalize(path.join(__dirname, 'outputFiles', filePath));

    // Determine the directory from the full file path
    const dir = path.dirname(fullFilePath);

    console.log('Directory:', dir);

    try {
        // Ensure the directory exists
        await fs.mkdir(dir, { recursive: true });

        // Write the file
        await fs.writeFile(fullFilePath, buffer);

        res.json({ message: 'File saved successfully' });
    } catch (err) {
        console.error('Error saving file:', err);
        return res.status(500).send('Error saving file');
    }
});


app.listen(3001, () => {
    console.log('receiver app listening on port 3001!');
});
