# GIBSON shell integration for bash, started as `bash --rcfile <this> -i`. Your own startup files
# run first, then this marks each prompt (OSC 133 A/B), where output starts (C, bash 4.4+), the
# exit code (D) and the folder (OSC 7).
if [ -n "$GIBSON_LOGIN" ]; then # it was meant to be a login shell
  [ -f /etc/profile ] && . /etc/profile
  for __gibson_f in ~/.bash_profile ~/.bash_login ~/.profile; do [ -f "$__gibson_f" ] && { . "$__gibson_f"; break; }; done
else
  [ -f ~/.bashrc ] && . ~/.bashrc
fi
unset GIBSON_LOGIN __gibson_f

__gibson_prompt() {
  local c=$?
  printf '\e]133;D;%s\a\e]7;file://%s%s\a' "$c" "${HOSTNAME:-localhost}" "$PWD"
  return $c
}
PROMPT_COMMAND="__gibson_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
PS1="\[\e]133;A\a\]$PS1\[\e]133;B\a\]"
PS0='\e]133;C\a'
