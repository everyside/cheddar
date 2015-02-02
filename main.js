var gProcessor=null;


function updateSolid()
{
  gProcessor.setJsCad(document.getElementById('code').value);
}

function showCode() {
  // Generate OpenSCAD code and display it.
  Blockly.OpenSCAD.INFINITE_LOOP_TRAP = null;
  var code = Blockly.OpenSCAD.workspaceToCode();
  console.log(code);
}

function runCode() {
  // Generate OpenSCAD code and run it.
  window.LoopTrap = 1000;
  Blockly.OpenSCAD.INFINITE_LOOP_TRAP =
      'if (--window.LoopTrap == 0) throw "Infinite loop.";\n';
  var code = Blockly.OpenSCAD.workspaceToCode();
  Blockly.OpenSCAD.INFINITE_LOOP_TRAP = null;
  try {
    eval(code);
  } catch (e) {
    console.log(e);
  }
}

function writeFileEntry(writableEntry, opt_blob, callback) {
  if (!writableEntry) {
    return;
  }

  writableEntry.createWriter(function(writer) {

    writer.onerror = errorHandler;
    writer.onwriteend = callback;

    // If we have data, write it to the file. Otherwise, just use the file we
    // loaded.
    if (opt_blob) {
      writer.truncate(opt_blob.size);
      waitForIO(writer, function() {
        writer.seek(0);
        writer.write(opt_blob);
      });
    }
    else {
      chosenEntry.file(function(file) {
        writer.truncate(file.fileSize);
        waitForIO(writer, function() {
          writer.seek(0);
          writer.write(file);
        });
      });
    }
  }, errorHandler);
}

window.onload = function() {

  //OpenJsCad.AlertUserOfUncaughtExceptions();
  var tmpContainer = document.getElementById("viewer");
  tmpContainer.style.display = "none";
  gProcessor = new OpenJsCad.Processor(tmpContainer, {viewerheight:"100%",viewerwidth:"60%"});

  document.body.appendChild(gProcessor.viewer.canvas);
  gProcessor.viewer.handleResize();
  updateSolid();

  //document.getElementById("updateButton").onclick=function(){updateSolid();};

  // document.getElementById("updateButton").addEventListener('click', function(e) {
  //   var config = {type: 'saveFile', suggestedName: "poo"};
  //   chrome.fileSystem.chooseEntry(config, function(writableEntry) {
  //     var blob = new Blob([document.getElementById('code').value], {type: 'text/plain'});
  //     console.log(blob);
  //     writeFileEntry(writableEntry, blob, function(e) {
  //       console.log(e);
  //     });
  //   });
  // });



  Blockly.inject(document.getElementById('blocklyDiv'),
        {toolbox: document.getElementById('toolbox')});

    Blockly.Blocks['sphere'] = {
      init: function() {
        this.setColour(230);

        this.appendDummyInput().appendField("Sphere : ")

        var dropdown = new Blockly.FieldDropdown([
        ['radius ', 'radius'],
        ['diameter', 'diameter']]);
        this.appendDummyInput().appendField(dropdown, 'INLINE');


        this.appendDummyInput().appendField(" = ")

        this.appendValueInput('VALUE')
        .setCheck('Number');

        this.setInputsInline(true);
        this.setTooltip('sphere');
      }
    };
};

