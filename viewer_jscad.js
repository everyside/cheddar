window.onload = function(){
  var sandbox = document.getElementById("sandbox");
  sandbox.width = window.innerWidth + "px";
  sandbox.height = window.innerHeight + "px";
  sandbox.contentWindow.postMessage(window.shapeCode, "*");
};

window.addEventListener("message", function(event){
  var sandbox = document.getElementById("sandbox");
  sandbox.contentWindow.postMessage(event.data, "*");
});