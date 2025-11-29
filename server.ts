import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'diagrams.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB open error:', err);
  else console.log('Connected to SQLite database');
});

// Initialize schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      blocks TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// API endpoints
app.get('/api/diagrams', (req, res) => {
  db.all('SELECT id, name FROM diagrams ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

app.get('/api/diagrams/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM diagrams WHERE id = ?', [id], (err, row: any) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Diagram not found' });
    } else {
      res.json({ id: row.id, name: row.name, blocks: JSON.parse(row.blocks) });
    }
  });
});

app.post('/api/diagrams', (req, res) => {
  const { name, blocks } = req.body;
  const id = `d${Date.now()}`;
  db.run(
    'INSERT INTO diagrams (id, name, blocks) VALUES (?, ?, ?)',
    [id, name, JSON.stringify(blocks)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ id, name, blocks });
      }
    }
  );
});

app.put('/api/diagrams/:id', (req, res) => {
  const { id } = req.params;
  const { name, blocks } = req.body;
  db.run(
    'UPDATE diagrams SET name = ?, blocks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, JSON.stringify(blocks), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id, name, blocks });
      }
    }
  );
});

app.delete('/api/diagrams/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM diagrams WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));