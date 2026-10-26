Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = currentDir & "\run_server_daemon.cmd"
WshShell.Run "cmd.exe /c """ & cmdPath & """", 0, False
