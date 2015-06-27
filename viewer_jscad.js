window.onload = function(){
  resize();
  sandbox.contentWindow.postMessage(window.shapeCode, "*");
};

function resize(){
  var sandbox = document.getElementById("sandbox");
  sandbox.width = window.innerWidth + "px";
  sandbox.height = window.innerHeight + "px";
}

window.onresize = resize;

window.addEventListener("message", function(event){
  var sandbox = document.getElementById("sandbox");
  sandbox.contentWindow.postMessage(event.data, "*");
});