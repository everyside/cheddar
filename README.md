# cheddar



App opens:
Cheddar App Controller
Properties
prefix
workspaceDir
shapeTemplatesDir
Methods
init()
IF not logged in, login()
ELSE list()
Prompt to create() or open()
login()
Authenticate GitHub api as user
Set prefs (prefix = “cheddar-shape-“, workspace-dir = “~/.cheddar/workspace/“, shape-templates-dir = “~/.cheddar/templates")
Create workspace dir, templates dir
Copy default and other tempaltes from /templates/* to templates dir
list()
Populate list view with shapes found in repos in github account that contain shape.json file
create()
new ShapeController.create()
open() (clicked shape in list)
new ShapeController.open(<shapeURL>)
View
File Menu : | [⌘N]ew Shape | Preferences | : when shape window is active : | [⌘S]ave | [⌘P]ublish | [⌘I]mport | [⌘R]ender | [⌘E]xport |
Preferences Window
prefix
workspace-dir
shape-templates-dir
Shape Controller
Properties
repo url
shape (object form of shape.json)
Methods
new()
prompt for shape name + repo name (default to prefix + shapename) + template (list subdirs of shape-templates dir) (defaults to “default”)
create repo in github, clone to workspace, create .jscad and shape.json files from templates/<template>
create dev-<username> branch
Open shape
open(shapeURL)
If origin is not my account, suggest forking it and bail.
Display .jscad source
Render shape
save() (toolbar button, auto every N seconds?)
Switch to dev branch
save file
Render shape 
On failure to render, display message in console (if manually invoked) and bail out.
git add all & commit
push dev branch
publish() (toolbar button)
Prompt for change description
Squash and rebase latest branch to dev branch with change description as new commit message
Merge dev to latest branch
import() (toolbar button)
Prompt for repo url and local nickname
Github browser?
Add repo as submodule (submodule name is nickname)
Clone all subsubmodules!
commit
push
render() (toolbar button, and auto on save)
Ensure editor-window-specific rendering window exists
Create temporary runnable script (from template?)
Include openjscad libs
Static include of all subrepos recursively (bottom-up order).  Each wrapped in function <nickname>() for scoping.
function takes json config for setting all shape params
include local shape’s .jscad file last.
render local shape file and display
save screenshot to <shape>.png
export() (as .stl) (toolbar button)
Choose location
Write .stl file.
view:
Source Window
Toolbar : | [⌘S]ave | [⌘P]ublish | [⌘I]mport | [⌘R]ender | [⌘E]xport |
Source Editor View
Render Window
Toolbar : [%R]erender] |
Render View
Browser console (dev tools?)


