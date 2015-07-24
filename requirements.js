window.getRepo = function(repoName, callback){
    
    var repo = {};
    require('js-github/mixins/github-db')(repo, repoName, cheddar.user.github.token);
    require('js-git/mixins/create-tree')(repo);
    //indexedDB.deleteDatabase("tedit");
    var indexD = require('js-git/mixins/indexed-db');
    indexD.init(function(){
      require('js-git/mixins/add-cache')(repo, indexD);
      require('js-git/mixins/mem-cache')(repo);
  
      require('js-git/mixins/read-combiner')(repo);
      require('js-git/mixins/formats')(repo);
      window.modes = require('js-git/lib/modes');
      callback(repo);
    });
};


