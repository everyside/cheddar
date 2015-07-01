var cheddar = (function CheddarController(){

  var ret = {
    
    user : {
      github : {
        name : "Cheddar",
        token : null,
        user : null,
      }
    },
    
    shapeViewControllers : {},
    
    init : function(callback){
      chrome.storage.sync.get("githubToken", function(val){
        this.user.github.token = val.githubToken;
      
        ret.getGithub();
        
        $("#inputNameRefresh").click(this.generateName);
        this.generateName();
        
        $("#inputName").keypress(this.updateRepoName);
        $("#inputName").change(this.updateRepoName);
        
        $("#inputGithubToken").val(this.user.github.token);
        $("#buttonAuthorize").click(cheddar.authorize);
        $("#buttonCreate").click(cheddar.createShape);
        
        ret.fire("cheddar.init");
        callback(val.githubToken);
      });
    },
    
    openShape : function(shapeURL){
      return null;
    },
    
    getGithub : function(){
      
      var ret = new Github({
        token: this.user.github.token,
        auth: "oauth"
      });
      
      var u = ret.getUser();
      if(u){
        console.log(u);
        u.show(null,function(err, info) {
          this.user.github.user = info.login;
          
          this.fire("github.connect");
          updateRepoName();
        });
        return ret;
      }else{
        return null;
      }
    },
    
    fire : function(){
      
    },
    
    handle : function(){
      
    },
    
    authorize : function(e){
      this.user.github.token = this.val();
      chrome.storage.sync.set({githubToken: this.user.github.token});
      initGithub();
    },
      
    generateName : function(){
      var name = generate_name("shapes").toLowerCase();
      $("#inputName").val(name);
      updateRepoName();
      return false;
    },
    
    updateRepoName : function(){
      chrome.storage.sync.get("repoPrefix", function(val){
        var name = $("#inputName").val();
        var prefix = val.repoPrefix || githubUser + "/cheddar-shape-";
        var repoName = prefix + name;
        $("#inputRepoName").val(repoName);
      });
    },
    
    createShape : function(){
      var shapeName = $("#inputName").val();
      var shapeDescription = $("#inputDescription").val();
      var shapeRepoName = $("#inputRepoName").val();
      var userName = githubUser;
      if(shapeRepoName.indexOf("/") > -1){
        var parts = shapeRepoName.split("/");
        console.log(parts);
        userName = parts[0];
        shapeRepoName = parts[1];
      }
      
      var fullRepoName = userName + "/" + shapeRepoName;
      var github = initGithub();
      console.log(github);
      //fixme - support repo creation in orgs (if userName is an org).
      github.getUser().createRepo({"name": shapeRepoName, auto_init : true}, function(err, res) {
        console.log("created repo.", err);
        
        var githubRepo = github.getRepo(userName, shapeRepoName);
        var branchName = "dev-"+githubUser;
        githubRepo.branch(branchName, function(){
          var repo = getRepo(userName+"/"+shapeRepoName);
          repo.readRef("refs/heads/"+branchName, function(err, headHash){
              
            //repo.saveAs("blob", "Hello World\n", function(err, blobHash){
              // Now we create a tree that is a folder containing the blob as `greeting.txt`
              var filename = shapeName + ".jscad";
              var updates = {
                "shape.json" : {mode:modes.file, content:"{\n\n}"}
              };
              updates[filename] = {mode:modes.file, content:"function main(){return   CSG.roundedCube({radius: 10, roundradius: 2, resolution: 16}).union(CSG.sphere({radius:10, resolution: 16}).translate([5, 5, 5]));}"};
              repo.createTree(updates, function(error, treeHash){
                
                var date = new Date();
                date.seconds = date.getTime() / 1000;
                date.offset = date.getTimezoneOffset();
                
                //Commit the staged updates
                repo.saveAs("commit", {
                  tree : treeHash,
                  author: {
                    name: "Dani Pletter",
                    email: "dani@everyside.com",
                    date: date
                  },
                  parent: headHash,
                  message: "Change README.md to be all uppercase using js-github"
                }, function(err, commitHash){
                  //Move dev branch to point at our new commit
                  repo.updateRef("refs/heads/"+branchName, commitHash, function(err, val){
                    console.log(val, err);
                    cheddar.openShape(fullRepoName);
                  });
                //});
              });
            });
          });
        });
      });
    }
  };
  
  function ShapeController(shapeURL){
    
    var ret = {
      
      editorView : null,
      renderView : null,
      repo : null,
      
      getGithub : function(){
        
      },
      
      save : function(repoName, code){
        console.log("save!");
        
        var repo = getRepo(userName+"/"+shapeRepoName);
        repo.readRef("refs/heads/"+branchName, function(err, headHash){
            
            var filename = shapeName + ".jscad";
            var updates = {
            };
            updates[filename] = {mode:modes.file, content:code};
            repo.createTree(updates, function(error, treeHash){
              
              var date = new Date();
              date.seconds = date.getTime() / 1000;
              date.offset = date.getTimezoneOffset();
              
              //Commit the staged updates
              repo.saveAs("commit", {
                tree : treeHash,
                author: {
                  name: "Dani Pletter",
                  email: "dani@everyside.com",
                  date: date
                },
                parent: headHash,
                message: "Incremental Edit"
              }, function(err, commitHash){
                //Move dev branch to point at our new commit
                repo.updateRef("refs/heads/"+branchName, commitHash, function(err, val){
                  console.log(val, err);
                  openShape(shapeName, userName, shapeRepoName);
                });
              //});
            });
          });
        });
      },
      
      view : function(shapeName, userName, repoName){
        console.log("opening " + repoName);
        var github = initGithub();
        var repo = getRepo(userName+"/"+repoName);
        
        repo.readRef("refs/heads/"+"dev-"+userName, function(err, headHash){
          repo.loadAs("commit", headHash, function(err, commit){
            repo.loadAs("tree", commit.tree, function(err, tree){
              var entry = tree[shapeName+".jscad"];
              repo.loadAs("text", entry.hash, function(err, contents){
                
                chrome.app.window.create(
                  'viewer_jscad.html',
                  {
                    id:userName+"_"+repoName + "_viewer",
                    state:'normal',
                    'bounds': {
                        'width': Math.round(window.screen.availWidth*0.4),
                        'height': Math.round(window.screen.availHeight * 0.95),
                        'left': Math.round(window.screen.availWidth*0.58)
                    },
                    frame:'none'
                  }, 
                  function(createdWindow) {
                    createdWindow.contentWindow.shapeCode = contents;
                  }
                );
                
                chrome.app.window.create(
                  'editor_jscad.html',
                  {
                    id:userName+"_"+repoName + "_editor",
                    state:'normal',
                    'bounds': {
                        'width': Math.round(window.screen.availWidth*0.4),
                        'height': Math.round(window.screen.availHeight * 0.95),
                        'left': Math.round(window.screen.availWidth*0.15)
                    },
                    frame:'none'
                  }, 
                  function(createdWindow) {
                    createdWindow.contentWindow.shapeCode = contents;
                    createdWindow.contentWindow.shapeViewer = userName+"_"+repoName + "_viewer";
                  }
                );
              });
            });
          });
        });
      }
    };
    return ret;
  }
  
  return ret;
}());





window.addEventListener("message", function(event){
  //var repoName = "FIXME";FIXME -- need to pass the shape metadata around.
  //save(repoName, event.data);
});





$(function(){
  
  cheddar.init();
  
});