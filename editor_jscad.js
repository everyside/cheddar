function changed(cm, change){
  var viewer = chrome.app.window.get(shapeViewer).contentWindow;
  viewer.postMessage({repo:shapeRepoName, code:cm.getValue(), name:shapeName}, "*");
  var list = chrome.app.window.get("list").contentWindow;
  list.postMessage({repo:shapeRepoName, code:cm.getValue()}, "*");
}

window.onload = function(){
  var editor = CodeMirror(document.body, {
    lineNumbers : true,
    mode : "javascript",
    value : shapeCode,
    viewportMargin:Infinity
  });
  
  editor.on("change", changed);
  changed(editor);
};