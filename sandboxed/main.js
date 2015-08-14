var gProcessor=null;


window.onload = function() {

  //OpenJsCad.AlertUserOfUncaughtExceptions();
  var viewer = document.getElementById("viewer");
  gProcessor = new OpenJsCad.Processor(viewer, {viewerheight:"100%",viewerwidth:"100%",libraries:["/sandboxed/lib/openscad.js"]});
  //gProcessor.debugging = true;
  document.body.appendChild(gProcessor.viewer.canvas);
  gProcessor.viewer.handleResize();
  
  $("#stlButton").click(function(e) {
    var anchor = document.createElement("a");
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.href = URL.createObjectURL(gProcessor.currentObjectToBlob());
    anchor.download = window.shapeName+".stl";
    anchor.click();
    document.body.removeChild(anchor);
  });
};

window.addEventListener("message", function(event){
  var config = event.data;
  window.shapeName = config.name;
  var code = config.code;
  console.log("received", code);
  gProcessor.setJsCad(code);
});
