# GIBSON: your .zprofile, for login shells (see .zshenv here).
__gibson_zdot=$ZDOTDIR
ZDOTDIR=${GIBSON_ZDOTDIR:-$HOME}
[ -f "$ZDOTDIR/.zprofile" ] && . "$ZDOTDIR/.zprofile"
ZDOTDIR=$__gibson_zdot
