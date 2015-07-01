function changed(cm, change){
  var viewer = chrome.app.window.get(shapeViewer).contentWindow;
  viewer.postMessage(cm.getValue(), "*");
}


window.onload = function(){
  var editor = CodeMirror(document.body, {
    lineNumbers : true,
    mode : "javascript",
    value : shapeCode,
    viewportMargin:Infinity
  });
  
  editor.on("change", changed);
};