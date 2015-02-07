window.addEventListener('message', function(event) {
    var target = event.data.target;
    var iframe = document.getElementById(target);
    iframe.contentWindow.postMessage(event.data, '*');
  });