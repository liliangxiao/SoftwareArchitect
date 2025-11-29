const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'diagrams.json');

app.use(cors());
app.use(express.json());

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ diagrams: [] }, null, 2));
}

function readData() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading data file:', err);
    return { diagrams: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} → ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/diagrams', (req, res) => {
  const data = readData();
  res.json(data.diagrams);
});

app.get('/api/diagrams/:id', (req, res) => {
  const data = readData();
  const d = data.diagrams.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(d);
});

app.post('/api/diagrams', (req, res) => {
  console.log('POST /api/diagrams body:', req.body);
  const data = readData();
  const item = { id: (Date.now()).toString(), name: req.body.name || 'Untitled', blocks: req.body.blocks || [] };
  data.diagrams.push(item);
  writeData(data);
  res.status(201).json(item);
});

app.put('/api/diagrams/:id', (req, res) => {
  const data = readData();
  const idx = data.diagrams.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.diagrams[idx] = { id: req.params.id, ...req.body };
  writeData(data);
  res.json(data.diagrams[idx]);
});

app.delete('/api/diagrams/:id', (req, res) => {
  const data = readData();
  data.diagrams = data.diagrams.filter(x => x.id !== req.params.id);
  writeData(data);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`File DB API running on http://localhost:${PORT}`));