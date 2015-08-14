window.onload = function(){
  resize();
  var sandbox = document.getElementById("sandbox");
  sandbox.contentWindow.postMessage({code:window.shapeCode, name:window.shapeName}, "*");
};

function resize(){
  var sandbox = document.getElementById("sandbox");
  sandbox.width = window.innerWidth + "px";
  sandbox.height = window.innerHeight + "px";
}

window.onresize = resize;

var code = "";

window.addEventListener("message", function(event){
  var sandbox = document.getElementById("sandbox");
  sandbox.contentWindow.postMessage(event.data, "*");
  saveSoon();
});

var lastChange = 0;

function saveSoon(){
  var stamp = new Date().getTime();
  lastChange = stamp;
  setTimeout(function(){
    if(stamp === lastChange){
      //save();
      chrome.app.window.get("list").contentWindow.postMessage(code, "*");
    }
  }, 3000);
}