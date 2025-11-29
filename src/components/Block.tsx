import React from 'react';
import { Port } from './Port';

interface BlockProps {
    name: string;
    type: string;
    ports: Array<{ name: string; type: string; value: any }>;
    onDoubleClick: () => void;
}

const Block: React.FC<BlockProps> = ({ name, type, ports, onDoubleClick }) => {
    return (
        <div className="block" onDoubleClick={onDoubleClick}>
            <h3>{name} ({type})</h3>
            <div className="ports">
                {ports.map((port, index) => (
                    <Port key={index} name={port.name} type={port.type} value={port.value} />
                ))}
            </div>
        </div>
    );
};

export default Block;