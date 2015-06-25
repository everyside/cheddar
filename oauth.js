
function poll(){
    var url = document.getElementById("webview").src;
    var index = url.indexOf("code=");
    if(index > -1){
      var code = url.substring(index + 5);
      
      window.close();
    }else{
      setTimeout(poll, 500);  
    }
}
    
$(poll);
    
