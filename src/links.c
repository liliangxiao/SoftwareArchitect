#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_STR 64
#define FILE_NAME "links_data.xml"

// --- Data Structures ---

typedef enum { DIR_NONE, DIR_IN, DIR_OUT } Direction;

typedef struct Port {
    char name[MAX_STR];
    char type[MAX_STR];
    Direction dir;
    char dest_module[MAX_STR]; // Only used if dir == DIR_OUT
    char dest_port[MAX_STR];   // Only used if dir == DIR_OUT
    struct Port* next;
} Port;

typedef struct Module {
    char name[MAX_STR];
    Port* ports;
    struct Module* next;
} Module;

Module* root_modules = NULL;

// --- Helper Functions ---

const char* dir_to_str(Direction d) {
    if (d == DIR_IN) return "in";
    if (d == DIR_OUT) return "out";
    return "none";
}

Direction str_to_dir(char* s) {
    if (strcmp(s, "in") == 0) return DIR_IN;
    if (strcmp(s, "out") == 0) return DIR_OUT;
    return DIR_NONE;
}

// Find or create a module
Module* get_module(const char* name, bool create) {
    Module* cur = root_modules;
    Module* last = NULL;
    while (cur) {
        if (strcmp(cur->name, name) == 0) return cur;
        last = cur;
        cur = cur->next;
    }
    if (!create) return NULL;

    Module* new_mod = (Module*)malloc(sizeof(Module));
    strcpy(new_mod->name, name);
    new_mod->ports = NULL;
    new_mod->next = NULL;

    if (last) last->next = new_mod;
    else root_modules = new_mod;
    return new_mod;
}

// Find or create a port within a module
Port* get_port(Module* mod, const char* port_name, bool create) {
    Port* cur = mod->ports;
    Port* last = NULL;
    while (cur) {
        if (strcmp(cur->name, port_name) == 0) return cur;
        last = cur;
        cur = cur->next;
    }
    if (!create) return NULL;

    Port* new_port = (Port*)malloc(sizeof(Port));
    strcpy(new_port->name, port_name);
    strcpy(new_port->type, "unknown"); // Default
    strcpy(new_port->dest_module, "");
    strcpy(new_port->dest_port, "");
    new_port->dir = DIR_NONE;
    new_port->next = NULL;

    if (last) last->next = new_port;
    else mod->ports = new_port;
    return new_port;
}

// --- XML Persistence ---

void save_xml() {
    FILE* f = fopen(FILE_NAME, "w");
    if (!f) return;
    fprintf(f, "<root>\n");
    Module* m = root_modules;
    while (m) {
        fprintf(f, "  <module name=\"%s\">\n", m->name);
        Port* p = m->ports;
        while (p) {
            fprintf(f, "    <port name=\"%s\" type=\"%s\" dir=\"%s\" dest_mod=\"%s\" dest_port=\"%s\" />\n",
                    p->name, p->type, dir_to_str(p->dir), p->dest_module, p->dest_port);
            p = p->next;
        }
        fprintf(f, "  </module>\n");
        m = m->next;
    }
    fprintf(f, "</root>\n");
    fclose(f);
}

void load_xml() {
    FILE* f = fopen(FILE_NAME, "r");
    if (!f) return;
    
    char line[512];
    Module* current_mod = NULL;

    while (fgets(line, sizeof(line), f)) {
        if (strstr(line, "<module")) {
            char* name_start = strstr(line, "name=\"") + 6;
            char* name_end = strchr(name_start, '\"');
            *name_end = '\0';
            current_mod = get_module(name_start, true);
        } else if (strstr(line, "<port") && current_mod) {
            char name[MAX_STR], type[MAX_STR], dir_s[MAX_STR], dmod[MAX_STR], dport[MAX_STR];
            // Simple parsing
            sscanf(line, "    <port name=\"%[^\"]\" type=\"%[^\"]\" dir=\"%[^\"]\" dest_mod=\"%[^\"]\" dest_port=\"%[^\"]\"", 
                   name, type, dir_s, dmod, dport);
            
            Port* p = get_port(current_mod, name, true);
            strcpy(p->type, type);
            p->dir = str_to_dir(dir_s);
            strcpy(p->dest_module, dmod);
            strcpy(p->dest_port, dport);
        }
    }
    fclose(f);
}

// --- Parsing Helper ---
// Parses "mod::port:type" or "mod::port"
// Returns true if successful
bool parse_arg(char* input, char* m_out, char* p_out, char* t_out) {
    char* sep1 = strstr(input, "::");
    if (!sep1) return false;
    
    *sep1 = '\0';
    strcpy(m_out, input);
    
    char* after_mod = sep1 + 2;
    char* sep2 = strchr(after_mod, ':');
    
    if (sep2 && t_out) {
        // Has type
        *sep2 = '\0';
        strcpy(p_out, after_mod);
        strcpy(t_out, sep2 + 1);
    } else {
        // No type (or not requested)
        strcpy(p_out, after_mod);
        if (t_out) strcpy(t_out, "unknown");
    }
    return true;
}

// --- Commands ---

void cmd_add(int argc, char* argv[]) {
    if (argc != 4) {
        printf("Error: 'add' requires exactly 2 link arguments.\n");
        printf("Usage: links add src_mod::src_port:type dst_mod::dst_port:type\n");
        return;
    }

    char src_m_name[MAX_STR], src_p_name[MAX_STR], src_type[MAX_STR];
    char dst_m_name[MAX_STR], dst_p_name[MAX_STR], dst_type[MAX_STR];

    if (!parse_arg(argv[2], src_m_name, src_p_name, src_type) || 
        !parse_arg(argv[3], dst_m_name, dst_p_name, dst_type)) {
        printf("Error: Invalid format. Use mod::port:type\n");
        return;
    }

    // 1. Get/Create Source Module and Port
    Module* mod_src = get_module(src_m_name, true);
    Port* port_src = get_port(mod_src, src_p_name, true);
    strcpy(port_src->type, src_type);
    
    // 2. Get/Create Destination Module and Port
    Module* mod_dst = get_module(dst_m_name, true);
    Port* port_dst = get_port(mod_dst, dst_p_name, true);
    strcpy(port_dst->type, dst_type);

    // 3. Strict Direction Logic
    // Source is strictly OUT
    port_src->dir = DIR_OUT;
    strcpy(port_src->dest_module, dst_m_name);
    strcpy(port_src->dest_port, dst_p_name);

    // Destination is strictly IN
    port_dst->dir = DIR_IN;
    // Destination ports don't store "source" info in this schema, 
    // they just sit there waiting to be pointed to.
    strcpy(port_dst->dest_module, ""); 
    strcpy(port_dst->dest_port, "");

    printf("Linked: [%s::%s] (OUT) --> [%s::%s] (IN)\n", 
           src_m_name, src_p_name, dst_m_name, dst_p_name);
}

void cmd_remove(int argc, char* argv[]) {
    if (argc != 4) {
        printf("Error: 'remove' requires exactly 2 link arguments to identify the link.\n");
        printf("Usage: links remove src_mod::src_port dst_mod::dst_port\n");
        return;
    }

    char src_m_name[MAX_STR], src_p_name[MAX_STR];
    char dst_m_name[MAX_STR], dst_p_name[MAX_STR];

    // Note: We ignore types here by passing NULL
    if (!parse_arg(argv[2], src_m_name, src_p_name, NULL) || 
        !parse_arg(argv[3], dst_m_name, dst_p_name, NULL)) {
        printf("Error: Invalid format. Use mod::port\n");
        return;
    }

    Module* mod_src = get_module(src_m_name, false);
    if (!mod_src) { printf("Error: Source module not found.\n"); return; }
    
    Port* port_src = get_port(mod_src, src_p_name, false);
    if (!port_src) { printf("Error: Source port not found.\n"); return; }

    // Check if the link matches
    if (strcmp(port_src->dest_module, dst_m_name) == 0 && 
        strcmp(port_src->dest_port, dst_p_name) == 0) {
        
        // Break the link
        port_src->dest_module[0] = '\0';
        port_src->dest_port[0] = '\0';
        port_src->dir = DIR_NONE; // Reset direction or keep as OUT? Resetting is safer.

        printf("Link removed. [%s::%s] is now disconnected.\n", src_m_name, src_p_name);
        
        // Note: We do not modify the destination port because IN ports 
        // don't store who connects to them in this simple model.
    } else {
        printf("Error: Link not found between these specific ports.\n");
    }
}

void cmd_list(const char* mod_name) {
    Module* m = get_module(mod_name, false);
    if (!m) {
        printf("Module '%s' not found.\n", mod_name);
        return;
    }
    
    printf("Module: %s\n", m->name);
    printf("----------------------------------------------------\n");
    printf("%-15s | %-10s | %-5s | %s\n", "Port", "Type", "Dir", "Destination");
    printf("----------------------------------------------------\n");
    
    Port* p = m->ports;
    while (p) {
        char dest[150]; // Large buffer to prevent overflow
        if (p->dir == DIR_OUT && strlen(p->dest_module) > 0) 
            snprintf(dest, sizeof(dest), "%s::%s", p->dest_module, p->dest_port);
        else 
            strcpy(dest, "--");

        printf("%-15s | %-10s | %-5s | %s\n", p->name, p->type, dir_to_str(p->dir), dest);
        p = p->next;
    }
}

void cmd_draw() {
    printf("\n--- System Diagram ---\n\n");
    Module* m = root_modules;
    while (m) {
        if(m->ports) {
            printf("[%s]\n", m->name);
            Port* p = m->ports;
            while(p) {
                // Formatting based on Direction
                if (p->dir == DIR_IN) {
                    printf("  -> (IN)  %s (%s)\n", p->name, p->type);
                } else if (p->dir == DIR_OUT) {
                    printf("  <- (OUT) %s (%s) connects to [%s::%s]\n", 
                           p->name, p->type, p->dest_module, p->dest_port);
                } else {
                    printf("     (---) %s (%s)\n", p->name, p->type);
                }
                p = p->next;
            }
            printf("\n");
        }
        m = m->next;
    }
}

void cmd_dot() {
    FILE* f = fopen("graph.dot", "w");
    if (!f) {
        printf("Error: Could not open graph.dot for writing.\n");
        return;
    }

    fprintf(f, "digraph G {\n");
    fprintf(f, "  rankdir=LR;\n"); // Left-to-Right graph flow
    fprintf(f, "  splines=ortho;\n"); // Orthogonal lines for neatness
    fprintf(f, "  node [shape=record, fontname=\"Arial\"];\n");
    
    Module* m = root_modules;
    while (m) {
        // Start the Record Label
        fprintf(f, "  %s [label=\"{", m->name);
        
        // --- 1. LEFT COLUMN: INPUTS (Vertical Stack) ---
        // We use an inner brace {} to create a vertical stack for inputs
        bool has_in = false;
        Port* p = m->ports;
        while(p) { if(p->dir == DIR_IN) has_in = true; p = p->next; }
        
        if (has_in) {
            fprintf(f, " {"); 
            p = m->ports;
            bool first = true;
            while (p) {
                if (p->dir == DIR_IN) {
                    if (!first) fprintf(f, "|");
                    fprintf(f, "<%s> %s", p->name, p->name);
                    first = false;
                }
                p = p->next;
            }
            fprintf(f, "} | "); // Close Input column and add separator
        }

        // --- 2. MIDDLE COLUMN: MODULE NAME ---
        // Display the module name in the center
        fprintf(f, " %s ", m->name);

        // --- 3. RIGHT COLUMN: OUTPUTS (Vertical Stack) ---
        // We use another inner brace {} for outputs
        bool has_out = false;
        p = m->ports; // Reset pointer
        while(p) { if(p->dir == DIR_OUT) has_out = true; p = p->next; }
        
        if (has_out) {
            fprintf(f, " | {"); // Separator and start Output column
            p = m->ports;
            bool first = true;
            while (p) {
                if (p->dir == DIR_OUT) {
                    if (!first) fprintf(f, "|");
                    fprintf(f, "<%s> %s", p->name, p->name);
                    first = false;
                }
                p = p->next;
            }
            fprintf(f, "} "); // Close Output column
        }

        // End the Record Label
        fprintf(f, "}\"];\n");
        
        m = m->next;
    }

    fprintf(f, "\n");

    // --- Define Edges ---
    m = root_modules;
    while (m) {
        Port* p = m->ports;
        while (p) {
            // Draw connection only from OUT ports
            if (p->dir == DIR_OUT && strlen(p->dest_module) > 0) {
                // Determine direction helpers (:e for east, :w for west)
                // This forces the line to leave the right and enter the left
                fprintf(f, "  %s:%s:e -> %s:%s:w;\n", 
                        m->name, p->name, p->dest_module, p->dest_port);
            }
            p = p->next;
        }
        m = m->next;
    }

    fprintf(f, "}\n");
    fclose(f);
    printf("Exported to graph.dot\n");
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage:\n links add src::port:type dst::port:type\n links remove src::port dst::port\n links list mod_name\n links draw\n links dot\n");
        return 0;
    }

    load_xml();

    if (strcmp(argv[1], "add") == 0) {
        cmd_add(argc, argv);
    } else if (strcmp(argv[1], "list") == 0) {
        if (argc > 2) cmd_list(argv[2]);
    } else if (strcmp(argv[1], "remove") == 0) {
        cmd_remove(argc, argv);
    } else if (strcmp(argv[1], "draw") == 0) {
        cmd_draw();
    } else if (strcmp(argv[1], "dot") == 0) {
        cmd_dot();
    }

    save_xml();
    return 0;
}