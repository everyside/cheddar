1. App opens:
    1. Cheddar App Controller
        1. Properties
            1. prefix
            2. workspaceDir
            3. shapeTemplatesDir

        2. Methods
            1. init()
                1. IF not logged in, login()
                2. ELSE list()
                3. Prompt to create() or open()

            2. login()
                1. Authenticate GitHub api as user
                2. Set prefs (prefix = “cheddar-shape-“, workspace-dir = “~/.cheddar/workspace/“, shape-templates-dir = “~/.cheddar/templates")
                3. Create workspace dir, templates dir
                4. Copy default and other tempaltes from /templates/* to templates dir

            3. list()
                1. Populate list view with shapes found in repos in github account that contain shape.json file

            4. create()
                1. new ShapeController.create()

            5. open() (clicked shape in list)
                1. new ShapeController.open(&lt;shapeURL&gt;)

        3. View
            1. File Menu : | [⌘N]ew Shape | Preferences | : when shape window is active : | [⌘S]ave | [⌘P]ublish | [⌘I]mport | [⌘R]ender | [⌘E]xport |
            2. Preferences Window
                1. prefix
                2. workspace-dir
                3. shape-templates-dir

    2. Shape Controller
        1. Properties
            1. repo url
            2. shape (object form of shape.json)

        2. Methods
            1. new()
                1. prompt for shape name + repo name (default to prefix + shapename) + template (list subdirs of shape-templates dir) (defaults to “default”)
                2. create repo in github, clone to workspace, create .jscad and shape.json files from templates/&lt;template&gt;
                3. create dev-&lt;username&gt; branch
                4. Open shape

            2. open(shapeURL)
                1. If origin is not my account, suggest forking it and bail.
                2. Display .jscad source
                3. Render shape

            3. save() (toolbar button, auto every N seconds?)
                1. Switch to dev branch
                2. save file
                3. Render shape 
                    1. On failure to render, display message in console (if manually invoked) and bail out.

                4. git add all & commit
                5. push dev branch

            4. publish() (toolbar button)
                1. Prompt for change description
                2. Squash and rebase latest branch to dev branch with change description as new commit message
                3. Merge dev to latest branch

            5. import() (toolbar button)
                1. Prompt for repo url and local nickname
                    1. Github browser?

                2. Add repo as submodule (submodule name is nickname)
                    1. Clone all subsubmodules!

                3. commit
                4. push

            6. render() (toolbar button, and auto on save)
                1. Ensure editor-window-specific rendering window exists
                2. Create temporary runnable script (from template?)
                    1. Include openjscad libs
                    2. Static include of all subrepos recursively (bottom-up order).  Each wrapped in function &lt;nickname&gt;() for scoping.
                        1. function takes json config for setting all shape params

                    3. include local shape’s .jscad file last.
                    4. render local shape file and display
                    5. save screenshot to &lt;shape&gt;.png

            7. export() (as .stl) (toolbar button)
                1. Choose location
                2. Write .stl file.

        3. view:
            1. Source Window
                1. Toolbar : | [⌘S]ave | [⌘P]ublish | [⌘I]mport | [⌘R]ender | [⌘E]xport |
                2. Source Editor View

            2. Render Window
                1. Toolbar : [%R]erender] |
                2. Render View
                3. Browser console (dev tools?)
