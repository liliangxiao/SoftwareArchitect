export interface Port {
    name: string;
    type: string;
    value: any;
}

export interface Block {
    id: string;
    name: string;
    type: string;
    ports: Port[];
}

export type BlockType = 'input' | 'output' | 'process';
export type PortType = 'input' | 'output';