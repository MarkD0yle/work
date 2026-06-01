/* Reference data for the GitHub Cheat Sheet page.
 *
 * A flat, searchable catalogue of the Git and GitHub CLI commands an operator
 * reaches for day to day. Each entry carries the command itself, a plain
 * explanation of what it does, and an optional concrete example so the page
 * can be both a lookup table and a teaching aid. Kept as data (not JSX) so the
 * page stays a thin view over it and search/filter logic has one source. */

export type CommandCategory =
  | "Setup & Config"
  | "Create & Clone"
  | "Stage & Commit"
  | "Branching"
  | "Merging & Rebasing"
  | "Remote & Sync"
  | "Inspect & Compare"
  | "Undo & Recover"
  | "Stashing"
  | "Tags & Releases"
  | "GitHub CLI (gh)";

export type GitCommand = {
  /** The command as you'd type it, with placeholders in <angle-brackets>. */
  command: string;
  /** Which group it belongs to — drives the filter chips. */
  category: CommandCategory;
  /** One-line plain-English explanation of what it does. */
  description: string;
  /** Optional worked example showing the command with real-ish arguments. */
  example?: string;
};

/** Stable display order for the category filter chips. */
export const CATEGORY_ORDER: CommandCategory[] = [
  "Setup & Config",
  "Create & Clone",
  "Stage & Commit",
  "Branching",
  "Merging & Rebasing",
  "Remote & Sync",
  "Inspect & Compare",
  "Undo & Recover",
  "Stashing",
  "Tags & Releases",
  "GitHub CLI (gh)",
];

export const GIT_COMMANDS: GitCommand[] = [
  // ---- Setup & Config ----
  {
    command: "git config --global user.name \"<name>\"",
    category: "Setup & Config",
    description:
      "Set the author name stamped on every commit you make on this machine.",
    example: 'git config --global user.name "Ada Lovelace"',
  },
  {
    command: "git config --global user.email \"<email>\"",
    category: "Setup & Config",
    description:
      "Set the author email for your commits. Use the email tied to your GitHub account so commits link to your profile.",
    example: 'git config --global user.email "ada@example.com"',
  },
  {
    command: "git config --global init.defaultBranch main",
    category: "Setup & Config",
    description:
      "Make new repositories start on a branch called 'main' instead of 'master'.",
  },
  {
    command: "git config --list",
    category: "Setup & Config",
    description:
      "Print every configuration value currently in effect, so you can confirm your settings.",
  },
  {
    command: "git config --global alias.<shortcut> <command>",
    category: "Setup & Config",
    description:
      "Create a shorthand for a longer command you type often.",
    example: "git config --global alias.co checkout",
  },

  // ---- Create & Clone ----
  {
    command: "git init",
    category: "Create & Clone",
    description:
      "Turn the current folder into a new Git repository, creating the hidden .git directory.",
  },
  {
    command: "git clone <url>",
    category: "Create & Clone",
    description:
      "Download a full copy of a remote repository — history and all — into a new folder.",
    example: "git clone https://github.com/octocat/Hello-World.git",
  },
  {
    command: "git clone <url> <dir>",
    category: "Create & Clone",
    description:
      "Clone a repository into a folder name of your choosing instead of the default.",
    example: "git clone git@github.com:octocat/Hello-World.git my-app",
  },
  {
    command: "git clone --depth 1 <url>",
    category: "Create & Clone",
    description:
      "Make a shallow clone with only the latest commit — fast, and handy for large repos when you don't need full history.",
  },

  // ---- Stage & Commit ----
  {
    command: "git status",
    category: "Stage & Commit",
    description:
      "Show which files are changed, staged, or untracked — your at-a-glance picture of the working tree.",
  },
  {
    command: "git add <file>",
    category: "Stage & Commit",
    description:
      "Stage a specific file's changes so they'll be included in the next commit.",
    example: "git add src/App.tsx",
  },
  {
    command: "git add .",
    category: "Stage & Commit",
    description:
      "Stage every change in the current directory and below. Quick, but check `git status` first so you don't commit junk.",
  },
  {
    command: "git add -p",
    category: "Stage & Commit",
    description:
      "Step through changes hunk by hunk, choosing which to stage — great for splitting work into clean commits.",
  },
  {
    command: "git commit -m \"<message>\"",
    category: "Stage & Commit",
    description:
      "Record the staged changes as a commit with a short summary message.",
    example: 'git commit -m "Fix off-by-one in pagination"',
  },
  {
    command: "git commit -am \"<message>\"",
    category: "Stage & Commit",
    description:
      "Stage all already-tracked files and commit in one step. Skips untracked (new) files.",
  },
  {
    command: "git commit --amend",
    category: "Stage & Commit",
    description:
      "Rewrite the most recent commit — fix its message or fold in newly staged changes. Avoid on commits you've already pushed.",
  },

  // ---- Branching ----
  {
    command: "git branch",
    category: "Branching",
    description:
      "List local branches; the current one is marked with an asterisk.",
  },
  {
    command: "git branch <name>",
    category: "Branching",
    description: "Create a new branch from the current commit (without switching to it).",
    example: "git branch feature/search",
  },
  {
    command: "git switch <name>",
    category: "Branching",
    description:
      "Move to an existing branch. The modern, clearer replacement for `git checkout <branch>`.",
    example: "git switch main",
  },
  {
    command: "git switch -c <name>",
    category: "Branching",
    description: "Create a new branch and switch to it in a single step.",
    example: "git switch -c fix/login-bug",
  },
  {
    command: "git branch -d <name>",
    category: "Branching",
    description:
      "Delete a branch that has already been merged. Use -D to force-delete an unmerged one.",
  },
  {
    command: "git branch -m <old> <new>",
    category: "Branching",
    description: "Rename a branch.",
    example: "git branch -m fix typo-fix",
  },

  // ---- Merging & Rebasing ----
  {
    command: "git merge <branch>",
    category: "Merging & Rebasing",
    description:
      "Combine another branch's history into your current branch, creating a merge commit if needed.",
    example: "git merge feature/search",
  },
  {
    command: "git merge --no-ff <branch>",
    category: "Merging & Rebasing",
    description:
      "Force a merge commit even when a fast-forward was possible, preserving the branch as a distinct event in history.",
  },
  {
    command: "git rebase <branch>",
    category: "Merging & Rebasing",
    description:
      "Replay your commits on top of another branch for a linear history. Don't rebase commits others have already pulled.",
    example: "git rebase main",
  },
  {
    command: "git rebase -i <commit>",
    category: "Merging & Rebasing",
    description:
      "Interactively reorder, squash, edit, or drop commits since a given point — your history clean-up tool.",
    example: "git rebase -i HEAD~3",
  },
  {
    command: "git rebase --abort",
    category: "Merging & Rebasing",
    description:
      "Bail out of a rebase that's gone wrong and return everything to how it was before you started.",
  },
  {
    command: "git cherry-pick <commit>",
    category: "Merging & Rebasing",
    description:
      "Copy a single commit from anywhere onto your current branch.",
    example: "git cherry-pick 4f2a9c1",
  },

  // ---- Remote & Sync ----
  {
    command: "git remote -v",
    category: "Remote & Sync",
    description:
      "List the remote repositories you're connected to and their URLs.",
  },
  {
    command: "git remote add <name> <url>",
    category: "Remote & Sync",
    description:
      "Register a new remote, conventionally named 'origin' for your main one.",
    example: "git remote add origin git@github.com:me/app.git",
  },
  {
    command: "git fetch <remote>",
    category: "Remote & Sync",
    description:
      "Download new commits and branches from a remote without changing your working files.",
    example: "git fetch origin",
  },
  {
    command: "git pull",
    category: "Remote & Sync",
    description:
      "Fetch from the remote and merge the changes into your current branch in one step.",
  },
  {
    command: "git pull --rebase",
    category: "Remote & Sync",
    description:
      "Update from the remote but replay your local commits on top instead of merging — keeps history linear.",
  },
  {
    command: "git push",
    category: "Remote & Sync",
    description:
      "Upload your committed changes to the remote tracking branch.",
  },
  {
    command: "git push -u origin <branch>",
    category: "Remote & Sync",
    description:
      "Push a branch for the first time and set it to track origin, so future `git push` needs no arguments.",
    example: "git push -u origin feature/search",
  },
  {
    command: "git push --force-with-lease",
    category: "Remote & Sync",
    description:
      "Overwrite the remote branch after a rebase, but safely refuse if someone else pushed in the meantime. Prefer this over --force.",
  },

  // ---- Inspect & Compare ----
  {
    command: "git log --oneline --graph --all",
    category: "Inspect & Compare",
    description:
      "Show a compact, visual graph of all branches and how their commits relate.",
  },
  {
    command: "git diff",
    category: "Inspect & Compare",
    description:
      "Show unstaged changes — the difference between your working files and what's staged.",
  },
  {
    command: "git diff --staged",
    category: "Inspect & Compare",
    description:
      "Show what you've staged — exactly what the next commit will contain.",
  },
  {
    command: "git show <commit>",
    category: "Inspect & Compare",
    description:
      "Display the full details and diff of a single commit.",
    example: "git show HEAD",
  },
  {
    command: "git blame <file>",
    category: "Inspect & Compare",
    description:
      "Annotate each line of a file with the commit and author that last changed it.",
    example: "git blame src/App.tsx",
  },
  {
    command: "git log -- <file>",
    category: "Inspect & Compare",
    description:
      "Show only the commits that touched a particular file.",
    example: "git log --oneline -- src/lib/qlik.ts",
  },

  // ---- Undo & Recover ----
  {
    command: "git restore <file>",
    category: "Undo & Recover",
    description:
      "Throw away unstaged changes to a file and restore it to the last committed version.",
    example: "git restore src/App.tsx",
  },
  {
    command: "git restore --staged <file>",
    category: "Undo & Recover",
    description:
      "Unstage a file (move it back out of the staging area) while keeping your edits.",
  },
  {
    command: "git reset --soft HEAD~1",
    category: "Undo & Recover",
    description:
      "Undo the last commit but keep its changes staged — useful for recommitting differently.",
  },
  {
    command: "git reset --hard <commit>",
    category: "Undo & Recover",
    description:
      "Reset your branch and working tree to a commit, discarding everything after it. Destructive — be sure.",
    example: "git reset --hard origin/main",
  },
  {
    command: "git revert <commit>",
    category: "Undo & Recover",
    description:
      "Create a new commit that undoes a previous one — the safe way to reverse history that's already shared.",
  },
  {
    command: "git reflog",
    category: "Undo & Recover",
    description:
      "Show a log of everywhere HEAD has been. Your safety net for finding 'lost' commits after a bad reset or rebase.",
  },

  // ---- Stashing ----
  {
    command: "git stash",
    category: "Stashing",
    description:
      "Shelve your uncommitted changes and return to a clean working tree — handy when you need to switch tasks fast.",
  },
  {
    command: "git stash push -m \"<message>\"",
    category: "Stashing",
    description: "Stash your changes with a label so you can recognise them later.",
    example: 'git stash push -m "half-done search box"',
  },
  {
    command: "git stash list",
    category: "Stashing",
    description: "Show all the stashes you've shelved.",
  },
  {
    command: "git stash pop",
    category: "Stashing",
    description:
      "Re-apply the most recent stash and remove it from the stash list.",
  },
  {
    command: "git stash drop",
    category: "Stashing",
    description: "Delete a stash you no longer need without applying it.",
  },

  // ---- Tags & Releases ----
  {
    command: "git tag",
    category: "Tags & Releases",
    description: "List all tags in the repository.",
  },
  {
    command: "git tag -a <name> -m \"<message>\"",
    category: "Tags & Releases",
    description:
      "Create an annotated tag — typically to mark a release — with a message and author info.",
    example: 'git tag -a v1.2.0 -m "Release 1.2.0"',
  },
  {
    command: "git push origin <tag>",
    category: "Tags & Releases",
    description:
      "Push a single tag to the remote (tags aren't pushed by a normal `git push`).",
    example: "git push origin v1.2.0",
  },
  {
    command: "git push --tags",
    category: "Tags & Releases",
    description: "Push all of your local tags to the remote at once.",
  },

  // ---- GitHub CLI (gh) ----
  {
    command: "gh auth login",
    category: "GitHub CLI (gh)",
    description:
      "Authenticate the GitHub CLI with your account, in the browser or with a token.",
  },
  {
    command: "gh repo clone <owner>/<repo>",
    category: "GitHub CLI (gh)",
    description: "Clone a GitHub repository by its name, no full URL needed.",
    example: "gh repo clone octocat/Hello-World",
  },
  {
    command: "gh repo create <name>",
    category: "GitHub CLI (gh)",
    description:
      "Create a new GitHub repository from the command line, optionally pushing the current folder to it.",
    example: "gh repo create my-app --public --source=. --push",
  },
  {
    command: "gh pr create",
    category: "GitHub CLI (gh)",
    description:
      "Open a pull request from your current branch, filling in title and body interactively.",
    example: 'gh pr create --title "Add search" --body "Adds filtering"',
  },
  {
    command: "gh pr list",
    category: "GitHub CLI (gh)",
    description:
      "List open pull requests in the current repository.",
  },
  {
    command: "gh pr checkout <number>",
    category: "GitHub CLI (gh)",
    description:
      "Check out a colleague's pull request locally to test or review it.",
    example: "gh pr checkout 42",
  },
  {
    command: "gh pr view --web",
    category: "GitHub CLI (gh)",
    description:
      "Open the current branch's pull request in your browser.",
  },
  {
    command: "gh issue create",
    category: "GitHub CLI (gh)",
    description:
      "File a new issue in the current repository from the terminal.",
  },
  {
    command: "gh run watch",
    category: "GitHub CLI (gh)",
    description:
      "Follow a GitHub Actions workflow run live until it finishes — useful for watching CI.",
  },
];
