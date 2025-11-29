class Block {
    constructor(name, type) {
        this.name = name;
        this.type = type;
        this.ports = [];
    }

    addPort(port) {
        this.ports.push(port);
    }

    removePort(portName) {
        this.ports = this.ports.filter(port => port.name !== portName);
    }

    getPorts() {
        return this.ports;
    }
}

export default Block;