export function serializeDiagram(diagram: any): string {
    return JSON.stringify(diagram);
}

export function deserializeDiagram(data: string): any {
    return JSON.parse(data);
}

export function serializeBlock(block: any): string {
    return JSON.stringify(block);
}

export function deserializeBlock(data: string): any {
    return JSON.parse(data);
}

export function serializePort(port: any): string {
    return JSON.stringify(port);
}

export function deserializePort(data: string): any {
    return JSON.parse(data);
}