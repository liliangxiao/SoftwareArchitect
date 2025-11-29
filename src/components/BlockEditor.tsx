import React, { useState } from 'react';

const BlockEditor = ({ block, onUpdate }) => {
    const [name, setName] = useState(block.name);
    const [type, setType] = useState(block.type);

    const handleUpdate = () => {
        onUpdate({ ...block, name, type });
    };

    return (
        <div className="block-editor">
            <h3>Edit Block</h3>
            <div>
                <label>Name:</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div>
                <label>Type:</label>
                <input
                    type="text"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                />
            </div>
            <button onClick={handleUpdate}>Update Block</button>
        </div>
    );
};

export default BlockEditor;