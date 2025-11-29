import { Block } from '../models/block';
import { Port } from '../models/port';
import { saveToDatabase, loadFromDatabase } from './db';

export const diagramService = {
    loadDiagram: async (id: string): Promise<Block[]> => {
        const data = await loadFromDatabase(id);
        return data.blocks.map((blockData: any) => new Block(blockData.name, blockData.type, blockData.ports.map((portData: any) => new Port(portData.name, portData.type, portData.value))));
    },

    saveDiagram: async (id: string, blocks: Block[]): Promise<void> => {
        const data = {
            blocks: blocks.map(block => ({
                name: block.name,
                type: block.type,
                ports: block.ports.map(port => ({
                    name: port.name,
                    type: port.type,
                    value: port.value
                }))
            }))
        };
        await saveToDatabase(id, data);
    }
};

export async function listDiagrams() {
  const res = await fetch('/api/diagrams');
  return res.json();
}

export async function getDiagram(id: string) {
  const res = await fetch(`/api/diagrams/${id}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export async function createDiagram(payload: any) {
  const res = await fetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateDiagram(id: string, payload: any) {
  const res = await fetch(`/api/diagrams/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}