import React from 'react';
import DiagramCanvas from '../components/DiagramCanvas';

const DiagramPage: React.FC = () => {
    return (
        <div>
            <h1>Block Diagram</h1>
            <DiagramCanvas />
        </div>
    );
};

export default DiagramPage;