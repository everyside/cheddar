/**
 * Listens for the app launching, then creates the window.
 *
 * @see http://developer.chrome.com/apps/app.runtime.html
 * @see http://developer.chrome.com/apps/app.window.html
 */
chrome.app.runtime.onLaunched.addListener(function(launchData) {
  chrome.app.window.create(
    'list.html',
    {
      id:'list',
      state:'normal',
      outerBounds:{left:10,width:250,height:700,top:100},
      frame:'none',
      resizable:false,
      
    }
  );
});
