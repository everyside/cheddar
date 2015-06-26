// Start out the normal way with a plain object.


// This only works for normal repos.  Github doesn't allow access to gists as
// far as I can tell.


// Your user can generate these manually at https://github.com/settings/tokens/new
// Or you can use an oauth flow to get a token for the user.
//var githubToken = "8fe7e5ad65814ea315daad99b6b65f2fd0e4c5aa";

// Mixin the main library using github to provide the following:
// - repo.loadAs(type, hash) => value
// - repo.saveAs(type, value) => hash
// - repo.listRefs(filter='') => [ refs ]
// - repo.readRef(ref) => hash
// - repo.updateRef(ref, hash) => hash
// - repo.deleteRef(ref) => null
// - repo.createTree(entries) => hash
// - repo.hasHash(hash) => has

window.db = require('js-git/mixins/indexed-db').init(function(){

window.doIt = function(){
  
  var githubName = "everyside/cheddar";

  chrome.storage.sync.get("githubToken", function(val){
    var githubToken = "8219d3eee60f8e00d41f39333e06dd23b229d474";//val.githubToken;
    window.githubToken = githubToken;
    
    var repo = {};
    
    
    require('js-github/mixins/github-db')(repo, githubName, githubToken);

// Github has this built-in, but it's currently very buggy so we replace with
// the manual implementation in js-git.
require('js-git/mixins/create-tree')(repo);

// Cache github objects locally in indexeddb


  
// require('js-git/mixins/add-cache')(repo, window.db);

// // Cache everything except blobs over 100 bytes in memory.
// // This makes path-to-hash lookup a sync operation in most cases.
// require('js-git/mixins/mem-cache')(repo);

// Combine concurrent read requests for the same hash
require('js-git/mixins/read-combiner')(repo);

// Add in value formatting niceties.  Also adds text and array types.
require('js-git/mixins/formats')(repo);
console.log(80);
    
    console.log(90);
      console.log(100);
      repo.readRef("refs/heads/master", function(err, headHash){
          
          console.log(110, err);
          repo.loadAs("commit", headHash, function(err, commit){
            
          console.log(120);
          repo.loadAs("tree", commit.tree, function(err, tree){
            
            
          var entry = tree["README.md"];
          repo.loadAs("text", entry.hash, function(err, readme){
            
            
        
          console.log(200);
          // Build the updates array
          var updates = [
            {
              path: "README.md", // Update the existing entry
              mode: entry.mode,  // Preserve the mode (it might have been executible)
              content: readme.toUpperCase() // Write the new content
            }
          ];
          console.log(300);
          // Based on the existing tree, we only want to update, not replace.
          updates.base = commit.tree;
        
          // Create the new file and the updated tree.
          repo.createTree(updates, function(err, treeHash){
            
          setTimeout(function(){
          console.log(400);
          
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
            
            debugger;
            console.log(500);
          
            // Now we can browse to this commit by hash, but it's still not in master.
            // We need to update the ref to point to this new commit.
          
            repo.updateRef("refs/heads/master", commitHash, function(){});
            console.log(600);
          
            
            
          });
          }, 1000);
          });
          });
          });
        });
      });
  });
};
});