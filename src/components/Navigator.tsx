import React from 'react';
import { useHistory } from 'react-router-dom';

const Navigator: React.FC = () => {
    const history = useHistory();

    const navigateToSubDiagram = (subDiagramId: string) => {
        history.push(`/sub-diagram/${subDiagramId}`);
    };

    return (
        <div className="navigator">
            <h2>Diagram Navigator</h2>
            {/* Example buttons for navigation */}
            <button onClick={() => navigateToSubDiagram('subDiagram1')}>Go to Sub-Diagram 1</button>
            <button onClick={() => navigateToSubDiagram('subDiagram2')}>Go to Sub-Diagram 2</button>
        </div>
    );
};

export default Navigator;