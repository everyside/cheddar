var cheddar = (function CheddarController(){

  var cheddar = {
    
    user : {
      github : {
        name : "Cheddar",
        token : null,
        user : null,
      }
    },
    
    shapeControllers : {},
    
    init : function(callback){
      chrome.storage.sync.get("githubToken", function(val){
        cheddar.user.github.token = val.githubToken;
      
        cheddar.getGithub();
        
        $("#inputNameRefresh").click(cheddar.generateName);
        cheddar.generateName();
        
        $("#inputName").keypress(cheddar.updateRepoName);
        $("#inputName").change(cheddar.updateRepoName);
        
        $("#inputGithubToken").val(cheddar.user.github.token);
        $("#buttonAuthorize").click(cheddar.authorize);
        $("#buttonCreate").click(cheddar.createShape);
        
        cheddar.fire("cheddar.init");
        
        if(callback){
          callback(val.githubToken);
        }
      });
    },
    
    getShapeController : function(config){
      var shapeController = cheddar.shapeControllers[config.repo] || new ShapeController(config);
      cheddar.shapeControllers[config.repo] = shapeController;
      return shapeController;
    },
    
    openShape : function(shapeURL){
      var shapeController = cheddar.shapeControllers[shapeURL] || new ShapeController(shapeURL);
      cheddar.shapeControllers[shapeURL] = shapeController;
      return shapeController.view();
    },
    
    getGithub : function(){
      
      var github = new Github({
        token: cheddar.user.github.token,
        auth: "oauth"
      });
      
      var u = github.getUser();
      if(u){
        console.log(u);
        u.show(null,function(err, info) {
          cheddar.user.github.user = info.login;
          
          cheddar.fire("github.connect");
          cheddar.updateRepoName();
        });
        return github;
      }else{
        return null;
      }
    },
    
    fire : function(){
      
    },
    
    handle : function(){
      
    },
    
    authorize : function(e){
      cheddar.user.github.token = $("#inputGithubToken").val();
      chrome.storage.sync.set({githubToken: cheddar.user.github.token});
      cheddar.getGithub();
    },
      
    generateName : function(){
      var name = generate_name("shapes").toLowerCase();
      $("#inputName").val(name);
      cheddar.updateRepoName();
      return false;
    },
    
    updateRepoName : function(){
      chrome.storage.sync.get("repoPrefix", function(val){
        var name = $("#inputName").val();
        var prefix = val.repoPrefix || cheddar.user.github.user + "/cheddar-shape-";
        var repoName = prefix + name;
        $("#inputRepoName").val(repoName);
      });
    },
    
    createShape : function(){
      var shapeName = $("#inputName").val();
      var shapeDescription = $("#inputDescription").val();
      var shapeRepoName = $("#inputRepoName").val();
      
      var shapeController = cheddar.getShapeController({repo:shapeRepoName, name:shapeName, description: shapeDescription});
      shapeController.create();
    }
    
  };
  
  function ShapeController(config){
    var shapeName = config.name;
    var shapeRepoName = config.repo;
    var shapeDescription = config.description;
    
    var self = {
      
      editorView : null,
      renderView : null,
      repo : null,
      
      getGithub : function(){
        
      },
      
      create : function(){
        
        var userName = cheddar.user.github.user;
        var shortRepoName = shapeRepoName
        if(shapeRepoName.indexOf("/") > -1){
          var parts = shapeRepoName.split("/");
          console.log(parts);
          userName = parts[0];
          shortRepoName = parts[1];
        }
        
        var fullRepoName = userName + "/" + shortRepoName;
        var github = cheddar.getGithub();
        console.log(github);
        //fixme - support repo creation in orgs (if userName is an org).
        github.getUser().createRepo({"name": shortRepoName, auto_init : true}, function(err, res) {
          console.log("created repo.", err);
          
          var githubRepo = github.getRepo(userName, shortRepoName);
          var branchName = "dev-"+cheddar.user.github.user;
          githubRepo.branch(branchName, function(){
            var repo = getRepo(userName+"/"+shortRepoName);
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
                      
                      self.view();
                    });
                  //});
                });
              });
            });
          });
        });
      },
      
      save : function(repoName, code){
        console.log("save!");
        
        var repo = getRepo(shapeRepoName);
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
      
      view : function(){
        console.log("opening " + shapeRepoName);
        var github = cheddar.getGithub();
        var repo = getRepo(shapeRepoName);
        
        repo.readRef("refs/heads/"+"dev-"+cheddar.user.github.user, function(err, headHash){
          repo.loadAs("commit", headHash, function(err, commit){
            repo.loadAs("tree", commit.tree, function(err, tree){
              var entry = tree[shapeName+".jscad"];
              repo.loadAs("text", entry.hash, function(err, contents){
                
                chrome.app.window.create(
                  'viewer_jscad.html',
                  {
                    id:cheddar.user.github.user+"_"+shapeName + "_viewer",
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
                    id:cheddar.user.github.user+"_"+shapeName + "_editor",
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
                    createdWindow.contentWindow.shapeViewer = cheddar.user.github.user+"_"+shapeName + "_viewer";
                  }
                );
              });
            });
          });
        });
      }
    };
    return self;
  }
  
  return cheddar;
}());

window.addEventListener("message", function(event){
  //var repoName = "FIXME";FIXME -- need to pass the shape metadata around.
  //save(repoName, event.data);
});





$(function(){
  
  cheddar.init();
  
});