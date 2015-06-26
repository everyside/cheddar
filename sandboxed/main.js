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
  var viewer = document.getElementById("viewer");
  gProcessor = new OpenJsCad.Processor(viewer, {viewerheight:"100%",viewerwidth:"100%"});
  document.body.appendChild(gProcessor.viewer.canvas);
  gProcessor.viewer.handleResize();
  updateSolid();

};

