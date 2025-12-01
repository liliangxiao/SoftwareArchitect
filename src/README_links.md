# Link Manager CLI

A lightweight command-line tool to manage connections between software or hardware modules. It automatically saves your work to an XML file and can generate high-quality diagrams using Graphviz.

## Features

  * **Simple Syntax:** Add and remove links using readable commands.
  * **Persistence:** All data is saved automatically to `links_data.xml`.
  * **Visualization:** Generates `.svg` diagrams showing how your modules interact.
  * **Smart Parsing:** Handles simple input (inheriting types) or detailed input (specifying types manually).

## Installation

### Prerequisites

1.  **GCC**: To compile the C code.
2.  **Graphviz**: To generate the SVG diagrams (specifically the `dot` command).

### Compile

Run the following command in your terminal:

```bash
gcc links.c -o links
```

## Usage Guide

The tool uses the format `Module::Port:Type`. The type is optional.

### 1\. Adding Links

To connect two modules, use the `add` command. The tool will automatically create the modules and ports if they don't exist.

**Basic Example:**
Connects the "Out" port of a Sensor to the "In" port of a Controller.

```bash
./links add Sensor::Out Controller::In
```

**Detailed Example (with Data Types):**
Connects a CPU data port (integer) to Memory.

```bash
./links add CPU::Data:int Memory::Input
```

*Note: If you omit the type on the destination, it inherits the type from the source.*

### 2\. Removing Links

To delete a connection, specify the source and destination.

```bash
./links remove Sensor::Out Controller::In
```

### 3\. Listing Ports

To see all ports belonging to a specific module:

```bash
./links list Sensor
```

### 4\. Text Visualization

To see a quick summary of the system in the terminal:

```bash
./links draw
```

### 5\. Graph Visualization (SVG)

To generate a professional-looking diagram:

```bash
./links dot
```

This command creates `graph.dot` and `graph.svg`. You can open `graph.svg` in any web browser to view your system diagram.

## File Structure

  * `links.c`: The source code.
  * `links`: The executable program.
  * `links_data.xml`: The database file where your modules and links are stored.
  * `graph.dot`: The intermediate file for Graphviz.
  * `graph.svg`: The final visual diagram.