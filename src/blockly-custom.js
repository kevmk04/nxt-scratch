import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

// Define custom block types
Blockly.common.defineBlocksWithJsonArray([
  // Program Start Hat Block
  {
    "type": "nxt_start",
    "message0": "when program starts",
    "nextStatement": null,
    "colour": 45,
    "hat": "cap",
    "tooltip": "The starting point of the robot program. Snap blocks underneath to run them.",
    "helpUrl": ""
  },
  // Play Tone Block
  {
    "type": "nxt_play_tone",
    "message0": "play tone %1 Hz for %2 ms",
    "args0": [
      {
        "type": "input_value",
        "name": "FREQUENCY",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "DURATION",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 300,
    "tooltip": "Emits a sound tone on the NXT brick's speaker.",
    "helpUrl": ""
  },
  // Set Motor Power Block
  {
    "type": "nxt_motor_power",
    "message0": "set motor %1 power to %2 %",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"],
          ["B", "B"],
          ["C", "C"],
          ["All", "ALL"]
        ]
      },
      {
        "type": "input_value",
        "name": "POWER",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 225,
    "tooltip": "Sets motor speed/power from -100 to 100.",
    "helpUrl": ""
  },
  // Stop Motor Block
  {
    "type": "nxt_motor_stop",
    "message0": "stop motor %1 with %2",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"],
          ["B", "B"],
          ["C", "C"],
          ["All", "ALL"]
        ]
      },
      {
        "type": "field_dropdown",
        "name": "MODE",
        "options": [
          ["brake", "BRAKE"],
          ["coast", "COAST"]
        ]
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 225,
    "tooltip": "Stops a motor. Brake stops immediately; coast lets it slow down gradually.",
    "helpUrl": ""
  },
  // Reset Motor Encoder Block
  {
    "type": "nxt_motor_reset",
    "message0": "reset encoder count for motor %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"],
          ["B", "B"],
          ["C", "C"]
        ]
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 225,
    "tooltip": "Resets the encoder/tachometer count for the selected motor.",
    "helpUrl": ""
  },
  // Turn Motor Indefinitely Block
  {
    "type": "nxt_motor_turn_indefinite",
    "message0": "turn motor %1 %2 at %3 % power",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"],
          ["B", "B"],
          ["C", "C"],
          ["All", "ALL"]
        ]
      },
      {
        "type": "field_dropdown",
        "name": "DIRECTION",
        "options": [
          ["forward", "FORWARD"],
          ["reverse", "REVERSE"]
        ]
      },
      {
        "type": "input_value",
        "name": "POWER",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 225,
    "tooltip": "Turns a motor indefinitely in the specified direction at the given power.",
    "helpUrl": ""
  },
  // Turn Motor for Specified Turns Block
  {
    "type": "nxt_motor_turn_fraction",
    "message0": "turn motor %1 %2 for %3 turns at %4 % power then %5",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"],
          ["B", "B"],
          ["C", "C"],
          ["All", "ALL"]
        ]
      },
      {
        "type": "field_dropdown",
        "name": "DIRECTION",
        "options": [
          ["forward", "FORWARD"],
          ["reverse", "REVERSE"]
        ]
      },
      {
        "type": "input_value",
        "name": "TURNS",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "POWER",
        "check": "Number"
      },
      {
        "type": "field_dropdown",
        "name": "MODE",
        "options": [
          ["brake", "BRAKE"],
          ["coast", "COAST"]
        ]
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 225,
    "tooltip": "Turns a motor for a specified number of turns in the given direction at the given power, then brakes or coasts.",
    "helpUrl": ""
  },
  // Read Touch Sensor Block (Boolean)
  {
    "type": "nxt_sensor_touch",
    "message0": "touch sensor %1 pressed?",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["S1", "0"],
          ["S2", "1"],
          ["S3", "2"],
          ["S4", "3"]
        ]
      }
    ],
    "output": "Boolean",
    "colour": 180,
    "tooltip": "Checks if the touch sensor on the selected port is pressed.",
    "helpUrl": ""
  },
  // Read Light Sensor Block (Number)
  {
    "type": "nxt_sensor_light",
    "message0": "light sensor %1 %",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["S1", "0"],
          ["S2", "1"],
          ["S3", "2"],
          ["S4", "3"]
        ]
      }
    ],
    "output": "Number",
    "colour": 180,
    "tooltip": "Reads the light sensor percentage value (0 to 100).",
    "helpUrl": ""
  },
  // Read Sound Sensor Block (Number)
  {
    "type": "nxt_sensor_sound",
    "message0": "sound sensor %1 %",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["S1", "0"],
          ["S2", "1"],
          ["S3", "2"],
          ["S4", "3"]
        ]
      }
    ],
    "output": "Number",
    "colour": 180,
    "tooltip": "Reads the sound sensor percentage value (0 to 100).",
    "helpUrl": ""
  },
  // Read Ultrasonic Sensor Block (Number)
  {
    "type": "nxt_sensor_ultrasonic",
    "message0": "ultrasonic sensor %1 distance (cm)",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["S1", "0"],
          ["S2", "1"],
          ["S3", "2"],
          ["S4", "3"]
        ]
      }
    ],
    "output": "Number",
    "colour": 180,
    "tooltip": "Reads the distance in centimeters from the ultrasonic sensor.",
    "helpUrl": ""
  },
  // Wait Seconds Block
  {
    "type": "nxt_wait",
    "message0": "wait %1 seconds",
    "args0": [
      {
        "type": "input_value",
        "name": "SECONDS",
        "check": "Number"
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "Pauses the execution for the specified number of seconds.",
    "helpUrl": ""
  },
  // Display Text Block
  {
    "type": "nxt_display_text",
    "message0": "display text %1 on line %2",
    "args0": [
      {
        "type": "input_value",
        "name": "TEXT"
      },
      {
        "type": "field_dropdown",
        "name": "LINE",
        "options": [
          ["Line 1", "LCD_LINE1"],
          ["Line 2", "LCD_LINE2"],
          ["Line 3", "LCD_LINE3"],
          ["Line 4", "LCD_LINE4"],
          ["Line 5", "LCD_LINE5"],
          ["Line 6", "LCD_LINE6"],
          ["Line 7", "LCD_LINE7"],
          ["Line 8", "LCD_LINE8"]
        ]
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 195,
    "tooltip": "Displays text on one of the 8 lines of the NXT screen.",
    "helpUrl": ""
  },
  // Display Number Block
  {
    "type": "nxt_display_number",
    "message0": "display number %1 on line %2",
    "args0": [
      {
        "type": "input_value",
        "name": "NUM",
        "check": "Number"
      },
      {
        "type": "field_dropdown",
        "name": "LINE",
        "options": [
          ["Line 1", "LCD_LINE1"],
          ["Line 2", "LCD_LINE2"],
          ["Line 3", "LCD_LINE3"],
          ["Line 4", "LCD_LINE4"],
          ["Line 5", "LCD_LINE5"],
          ["Line 6", "LCD_LINE6"],
          ["Line 7", "LCD_LINE7"],
          ["Line 8", "LCD_LINE8"]
        ]
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 195,
    "tooltip": "Displays a numeric value on one of the 8 lines of the NXT screen.",
    "helpUrl": ""
  },
  // Clear Display Line Block
  {
    "type": "nxt_display_clear_line",
    "message0": "clear display line %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "LINE",
        "options": [
          ["Line 1", "LCD_LINE1"],
          ["Line 2", "LCD_LINE2"],
          ["Line 3", "LCD_LINE3"],
          ["Line 4", "LCD_LINE4"],
          ["Line 5", "LCD_LINE5"],
          ["Line 6", "LCD_LINE6"],
          ["Line 7", "LCD_LINE7"],
          ["Line 8", "LCD_LINE8"]
        ]
      }
    ],
    "inputsInline": true,
    "previousStatement": null,
    "nextStatement": null,
    "colour": 195,
    "tooltip": "Clears a specific line on the NXT screen.",
    "helpUrl": ""
  },
  // Clear Display Screen Block
  {
    "type": "nxt_display_clear",
    "message0": "clear display",
    "previousStatement": null,
    "nextStatement": null,
    "colour": 195,
    "tooltip": "Clears all lines on the NXT screen.",
    "helpUrl": ""
  }
]);

javascriptGenerator.forBlock['nxt_start'] = function(block, generator) {
  return '';
};

// Define generators for Blockly custom blocks
javascriptGenerator.forBlock['nxt_play_tone'] = function(block, generator) {
  const freq = generator.valueToCode(block, 'FREQUENCY', generator.ORDER_NONE) || '440';
  const dur = generator.valueToCode(block, 'DURATION', generator.ORDER_NONE) || '500';
  return `await nxt.playTone(${freq}, ${dur});\n`;
};

javascriptGenerator.forBlock['nxt_motor_power'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const power = generator.valueToCode(block, 'POWER', generator.ORDER_NONE) || '0';
  return `await nxt.setMotorPower('${port}', ${power});\n`;
};

javascriptGenerator.forBlock['nxt_motor_stop'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const mode = block.getFieldValue('MODE');
  const brake = mode === 'BRAKE' ? 'true' : 'false';
  return `await nxt.stopMotor('${port}', ${brake});\n`;
};

javascriptGenerator.forBlock['nxt_motor_reset'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  return `await nxt.resetMotorPosition('${port}');\n`;
};

javascriptGenerator.forBlock['nxt_motor_turn_indefinite'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const direction = block.getFieldValue('DIRECTION');
  const power = generator.valueToCode(block, 'POWER', generator.ORDER_NONE) || '50';
  return `await nxt.turnMotorIndefinite('${port}', '${direction}', ${power});\n`;
};

javascriptGenerator.forBlock['nxt_motor_turn_fraction'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const direction = block.getFieldValue('DIRECTION');
  const turns = generator.valueToCode(block, 'TURNS', generator.ORDER_NONE) || '1';
  const power = generator.valueToCode(block, 'POWER', generator.ORDER_NONE) || '50';
  const mode = block.getFieldValue('MODE') || 'BRAKE';
  const brake = mode === 'BRAKE' ? 'true' : 'false';
  return `await nxt.turnMotorFraction('${port}', '${direction}', ${power}, ${turns}, ${brake});\n`;
};

javascriptGenerator.forBlock['nxt_sensor_touch'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const code = `await nxt.readTouch(${port})`;
  return [code, generator.ORDER_NONE];
};

javascriptGenerator.forBlock['nxt_sensor_light'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const code = `await nxt.readLight(${port})`;
  return [code, generator.ORDER_NONE];
};

javascriptGenerator.forBlock['nxt_sensor_sound'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const code = `await nxt.readSound(${port})`;
  return [code, generator.ORDER_NONE];
};

javascriptGenerator.forBlock['nxt_sensor_ultrasonic'] = function(block, generator) {
  const port = block.getFieldValue('PORT');
  const code = `await nxt.readUltrasonic(${port})`;
  return [code, generator.ORDER_NONE];
};

javascriptGenerator.forBlock['nxt_wait'] = function(block, generator) {
  const secs = generator.valueToCode(block, 'SECONDS', generator.ORDER_NONE) || '1';
  return `await wait(${secs});\n`;
};

// NXT Display Block Generators for Direct Execution
javascriptGenerator.forBlock['nxt_display_text'] = function(block, generator) {
  const text = generator.valueToCode(block, 'TEXT', generator.ORDER_NONE) || "''";
  const line = block.getFieldValue('LINE') || 'LCD_LINE1';
  const lineNum = line.replace('LCD_LINE', '');
  return `await nxt.displayText(String(${text}), ${lineNum});\n`;
};

javascriptGenerator.forBlock['nxt_display_number'] = function(block, generator) {
  const num = generator.valueToCode(block, 'NUM', generator.ORDER_NONE) || '0';
  const line = block.getFieldValue('LINE') || 'LCD_LINE1';
  const lineNum = line.replace('LCD_LINE', '');
  return `await nxt.displayText(String(${num}), ${lineNum});\n`;
};

javascriptGenerator.forBlock['nxt_display_clear_line'] = function(block, generator) {
  const line = block.getFieldValue('LINE') || 'LCD_LINE1';
  const lineNum = line.replace('LCD_LINE', '');
  return `await nxt.displayClearLine(${lineNum});\n`;
};

javascriptGenerator.forBlock['nxt_display_clear'] = function(block, generator) {
  return `await nxt.displayClear();\n`;
};

// --- Async Procedure Generators for Direct Execution ---
javascriptGenerator.forBlock['procedures_defnoreturn'] = function(block, generator) {
  const funcName = generator.getProcedureName(block.getFieldValue('NAME'));
  let xform1 = generator.statementToCode(block, 'STACK');
  if (generator.STATEMENT_PREFIX) {
    xform1 = generator.prefixLines(
        generator.STATEMENT_PREFIX.replace(/%1/g, '\'' + block.id + '\''),
        generator.INDENT) + xform1;
  }
  if (generator.INFINITE_LOOP_TRAP) {
    xform1 = generator.INFINITE_LOOP_TRAP.replace(/%1/g, '\'' + block.id + '\'') + xform1;
  }
  let returnValue = '';
  if (block.getInput('RETURN')) {
    returnValue = generator.valueToCode(block, 'RETURN', generator.ORDER_NONE) || '';
    if (returnValue) {
      returnValue = generator.INDENT + 'return ' + returnValue + ';\n';
    }
  }
  const args = [];
  const variables = block.getVars ? block.getVars() : [];
  for (let i = 0; i < variables.length; i++) {
    args[i] = generator.getVariableName(variables[i]);
  }
  let code = 'async function ' + funcName + '(' + args.join(', ') + ') {\n' +
      xform1 + returnValue + '}';
  code = generator.scrub_(block, code);
  generator.definitions_['%' + funcName] = code;
  return null;
};

javascriptGenerator.forBlock['procedures_defreturn'] = javascriptGenerator.forBlock['procedures_defnoreturn'];

javascriptGenerator.forBlock['procedures_callnoreturn'] = function(block, generator) {
  const funcName = generator.getProcedureName(block.getFieldValue('NAME'));
  const args = [];
  const variables = block.getVars ? block.getVars() : [];
  for (let i = 0; i < variables.length; i++) {
    args[i] = generator.valueToCode(block, 'ARG' + i, generator.ORDER_NONE) || 'null';
  }
  return 'await ' + funcName + '(' + args.join(', ') + ');\n';
};

javascriptGenerator.forBlock['procedures_callreturn'] = function(block, generator) {
  const funcName = generator.getProcedureName(block.getFieldValue('NAME'));
  const args = [];
  const variables = block.getVars ? block.getVars() : [];
  for (let i = 0; i < variables.length; i++) {
    args[i] = generator.valueToCode(block, 'ARG' + i, generator.ORDER_NONE) || 'null';
  }
  return ['await ' + funcName + '(' + args.join(', ') + ')', generator.ORDER_AWAIT || generator.ORDER_FUNCTION_CALL];
};

// Custom dark theme with Scratch-like start hats enabled
export const nxtTheme = Blockly.Theme.defineTheme('nxtDark', {
  base: Blockly.Themes.Classic,
  startHats: true,
  componentStyles: {
    workspaceBackgroundColour: 'transparent',
    toolboxBackgroundColour: 'rgba(15, 22, 38, 0.95)',
    toolboxForegroundColour: '#f3f4f6',
    flyoutBackgroundColour: '#080c14',
    flyoutForegroundColour: '#f3f4f6',
    flyoutOpacity: 0.95,
    scrollbarColour: '#334155',
    scrollbarOpacity: 0.4
  }
});

// JavaScript code generator with start block scoping (only executes chain connected to start block if present)
export function generateJavaScript(workspace) {
  if (!workspace) return '';
  javascriptGenerator.init(workspace);
  const topBlocks = workspace.getTopBlocks(true);

  // 1. First process all procedure definitions so they are registered in javascriptGenerator.definitions_
  const procBlocks = topBlocks.filter(b => b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn');
  for (const block of procBlocks) {
    javascriptGenerator.blockToCode(block);
  }

  // 2. Next process the main execution flow starting from 'nxt_start' (or all non-procedure top blocks as fallback)
  const startBlocks = topBlocks.filter(b => b.type === 'nxt_start');
  const blocksToProcess = startBlocks.length > 0
    ? startBlocks
    : topBlocks.filter(b => b.type !== 'procedures_defnoreturn' && b.type !== 'procedures_defreturn');

  const blocksCode = [];
  for (const block of blocksToProcess) {
    const line = javascriptGenerator.blockToCode(block);
    if (line) {
      blocksCode.push(line);
    }
  }
  return javascriptGenerator.finish(blocksCode.join('\n'));
}

// Define standard JSON toolbox configuration
export const toolboxJson = {
  "kind": "categoryToolbox",
  "contents": [
    {
      "kind": "category",
      "name": "Events",
      "colour": "45",
      "contents": [
        {
          "kind": "block",
          "type": "nxt_start"
        }
      ]
    },
    {
      "kind": "category",
      "name": "NXT Motors & Audio",
      "colour": "225",
      "contents": [
        {
          "kind": "block",
          "type": "nxt_motor_power",
          "inputs": {
            "POWER": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "nxt_motor_stop"
        },
        {
          "kind": "block",
          "type": "nxt_motor_reset"
        },
        {
          "kind": "block",
          "type": "nxt_motor_turn_indefinite",
          "inputs": {
            "POWER": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "nxt_motor_turn_fraction",
          "fields": {
            "MODE": "BRAKE"
          },
          "inputs": {
            "TURNS": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            },
            "POWER": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "nxt_play_tone",
          "inputs": {
            "FREQUENCY": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 440 }
              }
            },
            "DURATION": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 500 }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "NXT Display",
      "colour": "195",
      "contents": [
        {
          "kind": "block",
          "type": "nxt_display_text",
          "inputs": {
            "TEXT": {
              "shadow": {
                "type": "text",
                "fields": { "TEXT": "Hello NXT" }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "nxt_display_number",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 42 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "nxt_display_clear_line"
        },
        {
          "kind": "block",
          "type": "nxt_display_clear"
        },
        {
          "kind": "block",
          "type": "text",
          "fields": { "TEXT": "Hello" }
        },
        {
          "kind": "block",
          "type": "text_join",
          "extraState": {
            "itemCount": 2
          },
          "inputs": {
            "ADD0": {
              "shadow": {
                "type": "text",
                "fields": { "TEXT": "Hello " }
              }
            },
            "ADD1": {
              "shadow": {
                "type": "text",
                "fields": { "TEXT": "NXT" }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "NXT Sensing",
      "colour": "180",
      "contents": [
        {
          "kind": "block",
          "type": "nxt_sensor_touch"
        },
        {
          "kind": "block",
          "type": "nxt_sensor_light"
        },
        {
          "kind": "block",
          "type": "nxt_sensor_sound"
        },
        {
          "kind": "block",
          "type": "nxt_sensor_ultrasonic"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Control",
      "colour": "120",
      "contents": [
        {
          "kind": "block",
          "type": "nxt_start"
        },
        {
          "kind": "block",
          "type": "nxt_wait",
          "inputs": {
            "SECONDS": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "controls_repeat_ext",
          "inputs": {
            "TIMES": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 10 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "controls_whileUntil"
        },
        {
          "kind": "block",
          "type": "controls_if"
        },
        {
          "kind": "block",
          "type": "controls_if",
          "extraState": {
            "hasElse": true
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "Logic",
      "colour": "210",
      "contents": [
        {
          "kind": "block",
          "type": "logic_compare"
        },
        {
          "kind": "block",
          "type": "logic_operation"
        },
        {
          "kind": "block",
          "type": "logic_negate"
        },
        {
          "kind": "block",
          "type": "logic_boolean"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Math",
      "colour": "230",
      "contents": [
        {
          "kind": "block",
          "type": "math_number"
        },
        {
          "kind": "block",
          "type": "math_arithmetic",
          "inputs": {
            "A": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            },
            "B": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_single",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 9 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_trig",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 45 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_constant"
        },
        {
          "kind": "block",
          "type": "math_round",
          "inputs": {
            "NUM": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 3.1 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_modulo",
          "inputs": {
            "DIVIDEND": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 64 }
              }
            },
            "DIVISOR": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 10 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_random_int",
          "inputs": {
            "FROM": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            },
            "TO": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": 100 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "math_random_float"
        }
      ]
    },
    {
      "kind": "category",
      "name": "Variables",
      "custom": "VARIABLE",
      "colour": "330"
    },
    {
      "kind": "category",
      "name": "Functions",
      "custom": "PROCEDURE",
      "colour": "290"
    }
  ]
};
