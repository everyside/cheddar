var githubName = "Cheddar";
var githubToken = null;

function initGithub(){
  return new Github({
    token: githubToken,
    auth: "oauth"
  });
}

$(function(){
  
  chrome.storage.sync.get("githubToken", function(val){
    githubToken = val.githubToken;
    $("#inputGithubToken").val(githubToken);
  });
  
  $("#buttonAuthorize").click(function(e){
    githubToken = $("#inputGithubToken").val();
    chrome.storage.sync.set({githubToken: githubToken});
    initGit();
  });

  $("#buttonCreate").click(function(){
    
    var shapeName = $("#inputName").val();
    var shapeDescription = $("#inputDescription").val();
    var shapeRepoName = $("#inputRepoName").val();
    
    var github = initGithub();
    console.log(github);
    
    return;
    
    var githubName = "everyside/cheddar";
  
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