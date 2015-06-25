
function poll(){
    var url = document.getElementById("webview").src;
    console.log(url);
    var index = url.indexOf("code=");
    if(index > -1){
      var code = url.substring(index + 5);
      
      window.close();
    }else{
      setTimeout(poll, 500);  
    }
}
    
$(poll);
    
