I want to build application run locally that allow me manage my github repositories, cloned locally.
Probably written in electron. Uses system git client and credentials.
User could add a directories, that should be observed - read at startup then refreshed every defined period of time.
List repositories including:
- dir name (path in the title, short, started from ~ where possible)
- repo slug (server in the title)
- current branch
- number of local/remote changes
- option to pull changes
- option to change branch
- option to pull changes for all repos using --autostash. No conflict resolution: use another tool then. Make repo light red then.
- hilight repos with local changes as yellow
- option to fetch changes for all
- icon - link to github
- icon - open in intellij
- icon - open in vs code
- icon open in finder
- icon open in default terminal
- option to see all branches and deleted some - one by one
- option to see all worktrees and remove them