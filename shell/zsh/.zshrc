# GIBSON shell integration for zsh: your .zshrc, then marks for each prompt (OSC 133 A/B), where
# output starts (C), the exit code (D) and the folder (OSC 7). ZDOTDIR goes back to yours here,
# so .zlogin and anything later come from your own folder.
ZDOTDIR=${GIBSON_ZDOTDIR:-$HOME}
unset GIBSON_ZDOTDIR __gibson_zdot
[ -f "$ZDOTDIR/.zshrc" ] && . "$ZDOTDIR/.zshrc"

__gibson_precmd() { local c=$?; printf '\e]133;D;%s\a\e]7;file://%s%s\a' "$c" "$HOST" "$PWD"; return $c; }
__gibson_preexec() { printf '\e]133;C\a'; }
precmd_functions=(__gibson_precmd $precmd_functions)
preexec_functions+=(__gibson_preexec)
PS1=$'%{\e]133;A\a%}'"$PS1"$'%{\e]133;B\a%}'
