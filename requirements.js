window.initGit = function(){
    
    var repo = {};
    require('js-github/mixins/github-db')(repo, githubName, githubToken);
    require('js-git/mixins/create-tree')(repo);
    require('js-git/mixins/read-combiner')(repo);
    require('js-git/mixins/formats')(repo);
};


