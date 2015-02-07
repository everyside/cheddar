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
    backup_blocks();
  }
  console.log(code);
  codeHole.value = code;
  gProcessor.setJsCad(code);
}

function saveBlocksAs()
{
  var xml = Blockly.Xml.workspaceToDom( Blockly.mainWorkspace );
  var code = Blockly.Xml.domToText( xml );
  console.log(code);


  var message = {
   target: 'sandboxed',
   command: 'saveAs',
   code : code
 };
 window.parent.postMessage(message, '*');
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
  document.getElementById("saveAsButton").onclick=function(){saveBlocksAs();};

  Blockly.inject(document.getElementById('blocklyDiv'),
        {toolbox: document.getElementById('toolbox'), scrollbars:false});


  Blockly.addChangeListener(myUpdateFunction);



};

