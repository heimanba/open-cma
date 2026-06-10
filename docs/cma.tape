# OpenCMA Demo — AI Agent 的 Terraform
# Usage: vhs docs/cma.tape  (run from project root)

Output docs/cma.gif
Set Shell zsh
Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms
Set CursorBlink false

Sleep 200ms
Type "cat cma.yaml"
Enter
Sleep 1s

Type "cma validate"
Enter
Sleep 500ms

Type "cma plan"
Enter
Sleep 1s

Type "cma apply -y"
Enter
Sleep 3s

Type "cma state list"
Enter
Sleep 1s

Type "cma session create deepresearch"
Enter
Sleep 2s

Type "cma session list"
Enter
Sleep 1s

Type "cma destroy -y"
Enter
Sleep 3s

Sleep 500ms
