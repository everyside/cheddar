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
    
    getShapeController : function(config, callback){
      var shapeController = cheddar.shapeControllers[config.repo];
      if(shapeController){
        callback(shapeController);
      }else{
        new ShapeController(config, function(shapeController){
          
          cheddar.shapeControllers[config.repo] = shapeController;
          callback(shapeController);
        });
      }
    },
    
    getGithub : function(){
      
      var github = new Github({
        token: cheddar.user.github.token,
        auth: "oauth"
      });
      
      var u = github.getUser();
      if(u){
        u.show(null,function(err, info) {
          cheddar.user.github.user = info.login;
          
          cheddar.fire("github.connect");
          cheddar.updateRepoName();
          
          //update list
          var rows = [];
          u.userRepos(cheddar.user.github.user, function(err, repos){
            if(repos){
              
              var shapeRepos = [];
              for(var i=0;i<repos.length;i++){
                var repo = repos[i];
                if(repo.name.indexOf("cheddar-shape-") === 0){
                  shapeRepos.push(repo.full_name);
                }
                  
                  
                  // var r = github.getRepo(repo.owner.login, repo.name);
                  // r.deleteRepo(function(err, res){
                  //   console.log("deleted repo");
                  // });
                }
              }
              
              for(var j=0;j<shapeRepos.length;j++){
                var repoName = shapeRepos[j];
                cheddar.getShapeController({repo:repoName}, function(shapeController){
                  
                    rows[rows.length] = '<tr id="'+shapeController.repo+'"><td nowrap><h6>';
                    rows[rows.length] = shapeController.name;
                    rows[rows.length] = "</h6></td></tr>";
                    if(rows.length === (shapeRepos.length * 3)){
                      $("#shapeList").html(rows.join(""));
              
                      $('#shapeList tr').click(function() {
                        var id = $(this).attr("id");
                        cheddar.getShapeController({repo:id}, function(shapeController){
                          shapeController.view();
                        });
                      });
                    }
                  });
              
              
              
            }
          });
        
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
      
      cheddar.generateName();
      cheddar.getShapeController({repo:shapeRepoName, name:shapeName, description: shapeDescription}, function(shapeController){
        shapeController.create();  
      });
      
    }
    
  };
  
  function ShapeController(config, callback){
    var shapeRepoName = config.repo;
    
    var github = cheddar.getGithub();
    var repo = getRepo(shapeRepoName);
        
    repo.readRef("refs/heads/"+"dev-"+cheddar.user.github.user, function(err, headHash){
      if(headHash){
        repo.loadAs("commit", headHash, function(err, commit){
          if(commit){
            repo.loadAs("tree", commit.tree, function(err, tree){
              if(tree){
                var entry = tree["shape.json"];
                repo.loadAs("text", entry.hash, function(err, contents){
                  if(contents){
                    var shape = JSON.parse(contents);
                    self.name = shape.name;
                    self.description = shape.description;
                    callback(self);
                  }else{
                    callback(self);
                  }
                });
              }else{
                callback(self);
              }
            });
          }else{
            callback(self);
          }
        });
      }else{
        callback(self);
      }
    });
    
    var self = {
      
      name : config.name,
      repo : shapeRepoName,
      description : config.description,
      
      editorView : null,
      renderView : null,
      
      getGithub : function(){
        
      },
      
      create : function(){
        
        var userName = cheddar.user.github.user;
        var shortRepoName = shapeRepoName;
        if(shapeRepoName.indexOf("/") > -1){
          var parts = shapeRepoName.split("/");
          
          userName = parts[0];
          shortRepoName = parts[1];
        }
        
        var fullRepoName = userName + "/" + shortRepoName;
        var github = cheddar.getGithub();
        
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
                var filename = self.name + ".jscad";
                var updates = {
                  "shape.json" : {mode:modes.file, content:'{"name":"'+self.name+'","description":"'+self.description+'"}'}
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
                    message: "Create Shape Repo"
                  }, function(err, commitHash){
                    //Move dev branch to point at our new commit
                    repo.updateRef("refs/heads/"+branchName, commitHash, function(err, val){
                      
                      
                      self.view();
                    });
                  //});
                });
              });
            });
          });
        });
      },
      
      update : function(code){
        console.log("save!");
        
        var repo = getRepo(shapeRepoName);
        var branchName = "dev-"+cheddar.user.github.user;
        repo.readRef("refs/heads/"+branchName, function(err, headHash){
            repo.loadAs("commit", headHash, function(err, commit){
              
              var filename = self.name + ".jscad";
              var updates = [
                 {path:filename, mode:modes.file, content:code}
              ];
              updates.base = commit.tree;
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
                    
                    self.view();
                  });
                //});
              });
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
              var entry = tree[self.name+".jscad"];
              repo.loadAs("text", entry.hash, function(err, contents){
                
                chrome.app.window.create(
                  'viewer_jscad.html',
                  {
                    id:cheddar.user.github.user+"_"+self.name + "_viewer",
                    state:'normal',
                    'bounds': {
                        'width': Math.round(window.screen.availWidth*0.4),
                        'height': Math.round(window.screen.availHeight * 0.95),
                        'left': Math.round(window.screen.availWidth*0.58)
                    }
                  }, 
                  function(createdWindow) {
                    createdWindow.contentWindow.shapeCode = contents;
                  }
                );
                
                chrome.app.window.create(
                  'editor_jscad.html',
                  {
                    id:cheddar.user.github.user+"_"+self.name + "_editor",
                    state:'normal',
                    'bounds': {
                        'width': Math.round(window.screen.availWidth*0.4),
                        'height': Math.round(window.screen.availHeight * 0.95),
                        'left': Math.round(window.screen.availWidth*0.15)
                    }
                  }, 
                  function(createdWindow) {
                    createdWindow.contentWindow.shapeCode = contents;
                    createdWindow.contentWindow.shapeRepoName = shapeRepoName;
                    createdWindow.contentWindow.shapeViewer = cheddar.user.github.user+"_"+self.name + "_viewer";
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
  cheddar.getShapeController({repo:event.data.repo}, function(shapeController){ shapeController.update(event.data.code)});
});





$(function(){
  
  cheddar.init();
  
});