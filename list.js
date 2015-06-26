
$(function(){
  // $('#tabs li a').click(function(e){
  //   e.preventDefault();
  //   $(this).tab('show');
    
  // });
  
  $("#buttonAuthorize").click(function(e){
    var win = chrome.app.window.create("oauth.html", {
      id:"oauth",
      state:'normal',
      outerBounds:{left:400,width:900,height:700,top:200},
    });
    
    doIt();
    return false;
  });
  
});

function authorize(){
  
  //Open Window to : https://github.com/login/oauth/authorize?client_id=77dc82b5a606c7bf6261&scopes=repo,user
}