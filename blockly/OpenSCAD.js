/**
 * @license
 * Visual Blocks Language
 *
 * Copyright 2012 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Helper functions for generating OpenSCAD for blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.OpenSCAD');

goog.require('Blockly.Generator');


/**
 * OpenSCAD code generator.
 * @type !Blockly.Generator
 */
Blockly.OpenSCAD = new Blockly.Generator('OpenSCAD');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.OpenSCAD.addReservedWords(
  //http://en.wikibooks.org/wiki/OpenSCAD_User_Manual/The_OpenSCAD_Language
  //http://www.openscad.org/cheatsheet/index.html
  'cos,sin,tan,acos,asin,atan,atan2,abs,ceil,concat,cross,exp,floor,ln,len,let,log,lookup,max,min,norm,pow,rands,round,sign,sqrt,'+
  'str,chr,search,'+
  'scale,resize,rotate,translate,mirror,multmatrix,color,offset,minkowski,hull,'+
  'union,difference,intersection,render,'+
  'var,function,include,use,module,children,child,for,'+
  'circle,square,polygon,text,sphere,cube,cylinder,polyhedron,'+
  'version,version_num,cross,parent_module,echo,intersection,if,assign,linear_extrude,rotate_extrude,surface,projection,render,children,'+
  '$fa,$fs,$fn,$t,$vpr,$vpt,$pvd,$children');

/**
 * Order of operation ENUMs.
 * http://docs.openscad.org/reference/expressions.html#summary
 */
Blockly.OpenSCAD.ORDER_ATOMIC = 0;            // 0 "" ...
Blockly.OpenSCAD.ORDER_COLLECTION = 1;        // tuples, lists, dictionaries
Blockly.OpenSCAD.ORDER_STRING_CONVERSION = 1; // `expression...`
Blockly.OpenSCAD.ORDER_MEMBER = 2;            // . []
Blockly.OpenSCAD.ORDER_FUNCTION_CALL = 2;     // ()
Blockly.OpenSCAD.ORDER_EXPONENTIATION = 3;    // **
Blockly.OpenSCAD.ORDER_UNARY_SIGN = 4;        // + -
Blockly.OpenSCAD.ORDER_BITWISE_NOT = 4;       // ~
Blockly.OpenSCAD.ORDER_MULTIPLICATIVE = 5;    // * / // %
Blockly.OpenSCAD.ORDER_ADDITIVE = 6;          // + -
Blockly.OpenSCAD.ORDER_BITWISE_SHIFT = 7;     // << >>
Blockly.OpenSCAD.ORDER_BITWISE_AND = 8;       // &
Blockly.OpenSCAD.ORDER_BITWISE_XOR = 9;       // ^
Blockly.OpenSCAD.ORDER_BITWISE_OR = 10;       // |
Blockly.OpenSCAD.ORDER_RELATIONAL = 11;       // in, not in, is, is not,
                                            //     <, <=, >, >=, <>, !=, ==
Blockly.OpenSCAD.ORDER_LOGICAL_NOT = 12;      // not
Blockly.OpenSCAD.ORDER_LOGICAL_AND = 13;      // and
Blockly.OpenSCAD.ORDER_LOGICAL_OR = 14;       // or
Blockly.OpenSCAD.ORDER_CONDITIONAL = 15;      // if else
Blockly.OpenSCAD.ORDER_LAMBDA = 16;           // lambda
Blockly.OpenSCAD.ORDER_NONE = 99;             // (...)


/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.OpenSCAD.init = function(workspace) {
  // Create a dictionary of definitions to be printed before the code.
  Blockly.OpenSCAD.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  Blockly.OpenSCAD.functionNames_ = Object.create(null);

  if (!Blockly.OpenSCAD.variableDB_) {
    Blockly.OpenSCAD.variableDB_ =
        new Blockly.Names(Blockly.OpenSCAD.RESERVED_WORDS_);
  } else {
    Blockly.OpenSCAD.variableDB_.reset();
  }

  var defvars = [];
  var variables = Blockly.Variables.allVariables(workspace);
  for (var x = 0; x < variables.length; x++) {
    defvars[x] = Blockly.OpenSCAD.variableDB_.getName(variables[x],
        Blockly.Variables.NAME_TYPE) + ' = None';
  }
  Blockly.OpenSCAD.definitions_['variables'] = defvars.join('\n');
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.OpenSCAD.finish = function(code) {
  // Convert the definitions dictionary into a list.
  var imports = [];
  var definitions = [];
  for (var name in Blockly.OpenSCAD.definitions_) {
    var def = Blockly.OpenSCAD.definitions_[name];
    if (def.match(/^(from\s+\S+\s+)?import\s+\S+/)) {
      imports.push(def);
    } else {
      definitions.push(def);
    }
  }
  var allDefs = imports.join('\n') + '\n\n' + definitions.join('\n\n');
  return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code;
};

/**
 * Encode a string as a properly escaped OpenSCAD string, complete with quotes.
 * @param {string} string Text to encode.
 * @return {string} OpenSCAD string.
 * @private
 */
Blockly.OpenSCAD.quote_ = function(string) {
  // TODO: This is a quick hack.  Replace with goog.string.quote
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/\%/g, '\\%')
                 .replace(/'/g, '\\\'');
  return '\'' + string + '\'';
};

/**
 * Common tasks for generating OpenSCAD from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The OpenSCAD code created for this block.
 * @return {string} OpenSCAD code with comments and subsequent blocks added.
 * @private
 */
Blockly.OpenSCAD.scrub_ = function(block, code) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      commentCode += Blockly.OpenSCAD.prefixLines(comment, '# ') + '\n';
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var x = 0; x < block.inputList.length; x++) {
      if (block.inputList[x].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[x].connection.targetBlock();
        if (childBlock) {
          var comment = Blockly.OpenSCAD.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.OpenSCAD.prefixLines(comment, '# ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.OpenSCAD.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};
