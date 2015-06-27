var gProcessor=null;


window.onload = function() {

  //OpenJsCad.AlertUserOfUncaughtExceptions();
  var viewer = document.getElementById("viewer");
  gProcessor = new OpenJsCad.Processor(viewer, {viewerheight:"100%",viewerwidth:"100%"});
  document.body.appendChild(gProcessor.viewer.canvas);
  gProcessor.viewer.handleResize();
  console.log("shapeCode", window.shapeCode);
  gProcessor.setJsCad(window.shapeCode);
};


window.addEventListener("message", function(event){
  var code = event.data;
  console.log("received", code);
  gProcessor.setJsCad(code);
});
