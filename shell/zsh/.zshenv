# GIBSON: zsh starts in this folder (ZDOTDIR) so .zshrc here can add the shell integration.
# Your own startup files still run, from where they really are.
__gibson_zdot=$ZDOTDIR
ZDOTDIR=${GIBSON_ZDOTDIR:-$HOME}
[ -f "$ZDOTDIR/.zshenv" ] && . "$ZDOTDIR/.zshenv"
ZDOTDIR=$__gibson_zdot
