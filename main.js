var gProcessor=null;


function updateSolid()
{
  var codeHole = document.getElementById('code');
  var code;
  try{
    code = Blockly.JavaScript.workspaceToCode();
  }catch(e){
    console.log(e.stack);
  }

  if(!code || code.length < 1){
    code = codeHole.value;
  }else{
    code = "function main(){return "+code+";}";
  }
  console.log(code);
  codeHole.value = code;
  gProcessor.setJsCad(code);
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


function myUpdateFunction() {
  updateSolid();
}

window.onload = function() {

  //OpenJsCad.AlertUserOfUncaughtExceptions();
  var tmpContainer = document.getElementById("viewer");
  tmpContainer.style.display = "none";
  gProcessor = new OpenJsCad.Processor(tmpContainer, {viewerheight:"100%",viewerwidth:"60%"});

  document.body.appendChild(gProcessor.viewer.canvas);
  gProcessor.viewer.handleResize();

  document.getElementById("updateButton").onclick=function(){updateSolid();};

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
        {toolbox: document.getElementById('toolbox'), scrollbars:false});


  Blockly.addChangeListener(myUpdateFunction);


};

