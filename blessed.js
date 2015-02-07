window.addEventListener('message', function(event) {
    var command = event.data.command;
    switch(command) {
      case 'saveAs':
        saveAs(event.data.code);
    }
  });


function errorHandler(){
  console.log(arguments);
}

function saveAs(code){
  console.log("saving", code);


  //       event.source.postMessage({
  //         name: name,
  //         html: templates[name](event.data.context)
  //       }, event.origin);
  //       break;



  // document.getElementById("updateButton").addEventListener('click', function(e) {
    var config = {type: 'saveFile', suggestedName: "MyModule"};


    chrome.fileSystem.chooseEntry(config, function(writableFileEntry) {
    writableFileEntry.createWriter(function(writer) {
      writer.onerror = errorHandler;
      writer.onwriteend = function(e) {
        console.log('write complete');
      };

      writer.write(new Blob([code], {type: 'text/plain'}));
    }, errorHandler);
});
  // });
}
