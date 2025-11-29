import React, { useState } from 'react';

interface PortProps {
    name: string;
    type: string;
    value: any;
    onChange: (newValue: any) => void;
}

const Port: React.FC<PortProps> = ({ name, type, value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleBlur = () => {
        onChange(inputValue);
        setIsEditing(false);
    };

    return (
        <div className="port">
            <span className="port-name">{name} ({type}): </span>
            {isEditing ? (
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    autoFocus
                />
            ) : (
                <span onClick={handleEditToggle} className="port-value">{value}</span>
            )}
        </div>
    );
};

export default Port;