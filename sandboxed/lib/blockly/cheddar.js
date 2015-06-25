'use strict';

Blockly.Blocks['shape'] = {
      init: function() {
      this.setColour(110);
      this.setMovable(false);
      this.setDeletable(false);


      this.appendDummyInput()
          .appendField('Shape');

      this.appendDummyInput()
          .appendField('Name = ')
          .appendField(new Blockly.FieldTextInput('MyShape'));


      this.appendStatementInput('SHAPES')
          .appendField('');

      this.setInputsInline(false);
      this.setTooltip('shape');
    }
  };

  Blockly.Blocks['union'] = {
      init: function() {
      this.setColour(140);


      this.appendDummyInput()
          .appendField('Union');

      this.appendStatementInput('SHAPES')
          .appendField('');

      this.setInputsInline(false);
      this.setTooltip('union');
    }
  };


  Blockly.Blocks['sphere'] = {
    init: function() {
      this.setColour(10);
      this.setPreviousStatement(true);
      this.setNextStatement(true);

      this.appendDummyInput().appendField("Sphere : ");

      var dropdown = new Blockly.FieldDropdown([
      ['radius ', 'radius'],
      ['diameter', 'diameter']]);
      this.appendDummyInput().appendField(dropdown, 'TYPE');


      this.appendDummyInput().appendField(" = ");

      this.appendValueInput('SIZE')
          .setCheck('Number');

      this.setInputsInline(true);
      this.setTooltip('sphere');
    }
  };

  Blockly.Blocks['cube'] = {
    init: function() {
      this.setColour(10);
      this.setPreviousStatement(true);
      this.setNextStatement(true);

      this.appendDummyInput().appendField("Cube : ");


      this.appendDummyInput().appendField("size = ");
      this.appendValueInput('SIZE').setCheck('Number');

      this.setInputsInline(true);
      this.setTooltip('cube');
    }
  };



Blockly.JavaScript['shape'] = function(block) {
  // Repeat n times (internal number).
  var type = block.getFieldValue('TYPE');

  var size = Blockly.JavaScript.valueToCode(block, 'SIZE',
      Blockly.JavaScript.ORDER_ASSIGNMENT) || '1';

  var code = 'CSG.sphere({'+type+':'+size+'})';
  return code;
};

Blockly.JavaScript['sphere'] = function(block) {
  // Repeat n times (internal number).
  var type = block.getFieldValue('TYPE');

  var size = Blockly.JavaScript.valueToCode(block, 'SIZE',
      Blockly.JavaScript.ORDER_ASSIGNMENT) || '1';

  var code = 'CSG.sphere({'+type+':'+size+', resolution:16}).translate(5,5,5)';
  if(block.previousConnection.targetConnection.sourceBlock_.type === "union"){
    code += ".union("
  }else if(block.nextConnection.targetConnection != null){
    code += ",";
  }else{
    code += ")"
  }

  return code;
};

Blockly.JavaScript['cube'] = function(block) {
  // Repeat n times (internal number).

  var size = Blockly.JavaScript.valueToCode(block, 'SIZE',
      Blockly.JavaScript.ORDER_ASSIGNMENT) || '1';

  var code = 'CSG.roundedCube({radius:'+size+', roundradius: 2, resolution:16})';
  if(block.previousConnection.targetConnection.sourceBlock_.type === "union"){
    code += ".union("
  }else if(block.nextConnection.targetConnection != null){
    code += ",";
  }else{
    code += ")"
  }

  return code;
};

Blockly.JavaScript['union'] = function(block) {
  return Blockly.JavaScript.statementToCode(block, 'SHAPES');
};