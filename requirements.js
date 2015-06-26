window.getRepo = function(repoName){
    
    var repo = {};
    require('js-github/mixins/github-db')(repo, repoName, githubToken);
    require('js-git/mixins/create-tree')(repo);
    require('js-git/mixins/read-combiner')(repo);
    require('js-git/mixins/formats')(repo);
    window.modes = require('js-git/lib/modes');
    return repo;
};


