var githubName = "Cheddar";
var githubToken = null;
var githubUser = null;
var repo = null;

function initGithub(){
  var ret = new Github({
    token: githubToken,
    auth: "oauth"
  });
  
  var user = ret.getUser();
  if(user){
    console.log(user);
    user.show(null,function(err, info) {
      githubUser = info.login;
      
      updateRepoName();
    });
    return ret;
  }else{
    return null;
  }
}

function generateName(){
  var name = generate_name("shapes").toLowerCase();
  $("#inputName").val(name);
  updateRepoName();
}

function updateRepoName(){
  chrome.storage.sync.get("repoPrefix", function(val){
    var name = $("#inputName").val();
    var prefix = val.repoPrefix || githubUser + "/cheddar-shape-";
    var repoName = prefix + name;
    $("#inputRepoName").val(repoName);
  });
}

function openShape(repoName){
  console.log("opening " + repoName);
  chrome.app.window.create(
    'editor_jscad.js',
    {
      id:repoName + "_editor",
      state:'normal',
      'bounds': {
          'width': Math.round(window.screen.availWidth*0.4),
          'height': Math.round(window.screen.availHeight * 0.95),
          'left': Math.round(window.screen.availWidth*0.15)
      },
      frame:'none'
    }
  );
  
  chrome.app.window.create(
    'sandboxed/sandboxed.html',
    {
      id:repoName + "_viewer",
      state:'normal',
      'bounds': {
          'width': Math.round(window.screen.availWidth*0.4),
          'height': Math.round(window.screen.availHeight * 0.95),
          'left': Math.round(window.screen.availWidth*0.58)
      },
      frame:'none'
    }
  );
}

$(function(){
  
  chrome.storage.sync.get("githubToken", function(val){
    githubToken = val.githubToken;
    $("#inputGithubToken").val(githubToken);
    
    initGithub();
    
    $("#inputNameRefresh").click(generateName);
    generateName();
    
    $("#inputName").keypress(updateRepoName);
    $("#inputName").change(updateRepoName);
  });
  
  $("#buttonAuthorize").click(function(e){
    githubToken = $("#inputGithubToken").val();
    chrome.storage.sync.set({githubToken: githubToken});
    initGithub();
  });

  $("#buttonCreate").click(function(){
    
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
            updates[filename] = {mode:modes.file, content:"function main(){return sphere();}"};
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
                  openShape(fullRepoName);
                });
              //});
            });
          });
        });
        
      });
    });
    
    
    return;
    
    chrome.storage.sync.get("githubToken", function(val){
      repo.readRef("refs/heads/master", function(err, headHash){
        repo.loadAs("commit", headHash, function(err, commit){
          repo.loadAs("tree", commit.tree, function(err, tree){
            
            
            var entry = tree["README.md"];
            repo.loadAs("text", entry.hash, function(err, readme){
              
              var updates = [
                {
                  path: "README.md", // Update the existing entry
                  mode: entry.mode,  // Preserve the mode (it might have been executible)
                  content: readme.toUpperCase() // Write the new content
                }
              ];
              
              // Based on the existing tree, we only want to update, not replace.
              updates.base = commit.tree;
            
              // Create the new file and the updated tree.
              repo.createTree(updates, function(err, treeHash){
              
                var date = new Date();
                date.seconds = date.getTime() / 1000;
                date.offset = date.getTimezoneOffset();
                
                repo.saveAs("commit", {
                  tree: treeHash,
                  author: {
                    name: "Dani Pletter",
                    email: "dani@everyside.com",
                    date: date
                  },
                  parent: headHash,
                  message: "Change README.md to be all uppercase using js-github"
                }, function(err, commitHash){
          
                  // Now we can browse to this commit by hash, but it's still not in master.
                  // We need to update the ref to point to this new commit
                  repo.updateRef("refs/heads/master", commitHash, function(){});
                });
              });
            });
          });
        });
      });
    });
  });
});