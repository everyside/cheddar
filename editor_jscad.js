window.onload = function(){
  var editor = CodeMirror(document.body, {
    lineNumbers : true,
    mode : "javascript",
    value : shapeCode,
    viewportMargin:Infinity
  });
};