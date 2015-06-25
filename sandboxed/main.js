var gProcessor=null;


function updateSolid()
{
  var codeHole = document.getElementById('code');
  var code = codeHole.value;
  
  console.log(code);
  codeHole.value = code;
  gProcessor.setJsCad(code);
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

};

