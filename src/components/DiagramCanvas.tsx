import React from 'react';
import Block from './Block';
import Port from './Port';

const DiagramCanvas = () => {
    const blocks = []; // This should be populated with block data
    const handleBlockDoubleClick = (blockId) => {
        // Logic to navigate to sub-diagram
    };

    return (
        <div className="diagram-canvas">
            {blocks.map(block => (
                <Block 
                    key={block.id} 
                    block={block} 
                    onDoubleClick={() => handleBlockDoubleClick(block.id)} 
                />
            ))}
            {/* Render ports here if needed */}
        </div>
    );
};

export default DiagramCanvas;