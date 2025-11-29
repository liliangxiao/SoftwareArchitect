import fs from 'fs';
import path from 'path';

const dbFilePath = path.join(__dirname, 'database.json');

export const loadDiagrams = () => {
    if (!fs.existsSync(dbFilePath)) {
        return [];
    }
    const data = fs.readFileSync(dbFilePath, 'utf-8');
    return JSON.parse(data);
};

export const saveDiagrams = (diagrams) => {
    fs.writeFileSync(dbFilePath, JSON.stringify(diagrams, null, 2));
};